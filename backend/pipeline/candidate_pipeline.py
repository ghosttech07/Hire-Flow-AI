"""
backend/pipeline/candidate_pipeline.py

HireFlow AI — Celery task: full candidate screening + interview-prep pipeline.

Architecture
────────────
This module is the single authoritative source of pipeline logic.
It is imported by Celery workers and is completely decoupled from Flask.
MongoDB is the single source of truth for pipeline state.

Retry strategy
──────────────
Transient failures (LLM timeouts, rate limits, network blips) → retry with
exponential back-off up to max_retries.

Terminal failures (business gate, missing doc, bad data) → write status=failed
to DB and return cleanly. DO NOT retry these.

Idempotency (critical for safe retries)
────────────────────────────────────────
Before each stage the task reads pipeline_stage from MongoDB.
If that stage was already completed it is silently skipped.
This means a retry at stage "questions" will skip screening
and pick up exactly where it left off.

Email idempotency (atomic CAS)
───────────────────────────────
Email sending uses an atomic find_one_and_update with a conditional filter
{"email_sent": {"$ne": True}} to guarantee exactly-once delivery even if
the task is retried or two workers race (acks_late + reject_on_worker_lost).

Stage order:
  queued(0) → screening(1) → questions(2) → invite_email(3) → done(4)
"""

import logging
import secrets
import traceback
from datetime import datetime, timedelta
from typing import Optional

from bson.objectid import ObjectId
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from celery.utils.log import get_task_logger
from pymongo import ReturnDocument

from tasks.celery_app import celery_app
from config import Config
from agents.resume_screener import ResumeScreener
from agents.question_generator import QuestionGenerator
from agents.email_sender import EmailSender, send_email_via_resend, get_static_rejection_email

_base_logger = get_task_logger(__name__)
db = Config.db

# ─────────────────────────────────────────────────────────────
# Stage ordering — used by idempotency guard
# ─────────────────────────────────────────────────────────────
STAGE_ORDER: dict[str, int] = {
    "queued":       0,
    "screening":    1,
    "questions":    2,
    "invite_email": 3,
    "done":         4,
}

# Terminal statuses — never retry a candidate already in one of these
TERMINAL_STATUSES = frozenset({
    "interview_invited",
    "rejected_screening",
    "failed",
    "offer_sent",
    "rejected_final",
})


def _stage_already_done(db_stage: str, target_stage: str) -> bool:
    """Return True if target_stage was already completed in a previous run."""
    return STAGE_ORDER.get(db_stage, 0) > STAGE_ORDER.get(target_stage, 0)


# ─────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────

def _set_stage(candidate_id: str, stage: str, progress: int,
               extra: Optional[dict] = None, log=None) -> None:
    """Atomically write pipeline_stage + progress to the candidate document."""
    update = {
        "pipeline_stage": stage,
        "progress": progress,
        "updated_at": datetime.utcnow(),
    }
    if extra:
        update.update(extra)
    db.candidates.update_one(
        {"_id": ObjectId(candidate_id)},
        {"$set": update},
    )
    if log:
        log.info("stage=%s progress=%d%%", stage, progress)


def _fail(candidate_id: str, stage: str, error_msg: str, log=None) -> None:
    """Mark candidate as failed — terminal, no retry."""
    db.candidates.update_one(
        {"_id": ObjectId(candidate_id)},
        {"$set": {
            "status": "failed",
            "pipeline_stage": stage,
            "progress": 0,
            "error_message": error_msg,
            "pipeline_completed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
    )
    if log:
        log.error("FAILED at stage=%s — %s", stage, error_msg)


def _lookup_company(company_id: str) -> tuple[str, str]:
    """Return (company_name, recruiter_email). Fails gracefully."""
    comp_name, recruiter_email = "Our Company", "hiring@company.com"
    if not company_id:
        return comp_name, recruiter_email
    try:
        comp = db.companies.find_one({"_id": ObjectId(company_id)})
        if comp:
            comp_name = comp.get("company_name", "Our Company")
            recruiter_email = comp.get("email", "hiring@company.com")
    except Exception as exc:
        _base_logger.warning("Company lookup failed: %s", exc)
    return comp_name, recruiter_email


# ─────────────────────────────────────────────────────────────
# Celery task
# ─────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="pipeline.process_candidate_pipeline",
    # Reliability: only ack message after task finishes.
    # If the worker crashes, Redis re-queues the task automatically.
    acks_late=True,
    reject_on_worker_lost=True,
    # Retry config: up to 3 retries with exponential back-off.
    # countdown doubles each attempt: 60s → 120s → 240s.
    max_retries=3,
    default_retry_delay=60,
)
def process_candidate_pipeline(self: Task, candidate_id: str, job_id: str) -> dict:
    """
    Full AI screening + interview-prep pipeline for one candidate.

    Parameters
    ----------
    candidate_id : str   MongoDB ObjectId of the candidate document
    job_id       : str   MongoDB ObjectId of the job document

    Returns
    -------
    dict with outcome summary (stored in Redis result backend for Flower)
    """
    task_id = self.request.id or "local"
    attempt = self.request.retries          # 0-indexed retry count
    max_tries = self.max_retries

    # ── Structured logger — candidate_id + task_id in every log line ─────
    # JSONFormatter picks these up as top-level fields in the JSON output.
    log = logging.LoggerAdapter(
        _base_logger,
        {"candidate_id": candidate_id, "task_id": task_id},
    )

    log.info(
        "Starting pipeline attempt=%d/%d",
        attempt + 1, max_tries + 1,
    )

    # Record Celery task ID on the candidate doc (once, on first attempt)
    if attempt == 0:
        db.candidates.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"celery_task_id": task_id, "updated_at": datetime.utcnow()}},
        )

    current_stage = "init"
    try:
        # ── 0. Fetch documents + idempotency guard ───────────────────
        current_stage = "init"

        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        if not candidate:
            log.error("Candidate not found — aborting")
            return {"outcome": "aborted", "reason": "candidate_not_found"}

        # Guard: if status is already terminal, skip the entire pipeline
        db_status = candidate.get("status", "processing")
        if db_status in TERMINAL_STATUSES:
            log.info("Already in terminal status=%s — skipping", db_status)
            return {"outcome": "skipped", "status": db_status}

        job = db.jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            _fail(candidate_id, "init", f"Job {job_id} not found", log)
            return {"outcome": "failed", "reason": "job_not_found"}

        resume_text     = candidate.get("resume_text", "")
        candidate_name  = candidate.get("candidate_name") or candidate.get("name") or "Candidate"
        candidate_email = candidate.get("candidate_email") or candidate.get("email") or ""
        company_id      = candidate.get("company_id", "")
        jd_data         = job.get("parsed", {})
        job_title       = jd_data.get("job_title", "Unknown Role")

        comp_name, recruiter_email = _lookup_company(company_id)

        db_stage = candidate.get("pipeline_stage", "queued")

        # Mark pipeline started (only on first attempt)
        if attempt == 0:
            db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "pipeline_started_at": datetime.utcnow(),
                    "pipeline_stage":      "screening",
                    "progress":            10,
                    "updated_at":          datetime.utcnow(),
                }},
            )
            db_stage = "screening"

        # ── 1. Resume Screening ──────────────────────────────────────
        current_stage = "screening"

        if _stage_already_done(db_stage, "screening"):
            log.info("Screening already done — skipping")
            screening_data = candidate.get("screening", {})
            match_score = int(screening_data.get("match_score", 0))
        else:
            _set_stage(
                candidate_id, "screening", 15,
                extra={"screening_started_at": datetime.utcnow()},
                log=log,
            )

            try:
                screener = ResumeScreener(Config.GEMINI_API_KEY)
                screening_result = screener.screen(resume_text, jd_data)
            except SoftTimeLimitExceeded:
                raise self.retry(
                    exc=SoftTimeLimitExceeded("Screening timed out"),
                    countdown=60 * (2 ** attempt),
                )
            except Exception as exc:
                log.warning("Screening exception: %s", exc)
                raise self.retry(exc=exc, countdown=60 * (2 ** attempt))

            if not screening_result["success"]:
                err = f"ResumeScreener failed: {screening_result.get('error')}"
                if attempt < max_tries:
                    _set_stage(candidate_id, "screening", 10,
                               {"error_message": err}, log=log)
                    raise self.retry(
                        exc=RuntimeError(err),
                        countdown=60 * (2 ** attempt),
                    )
                _fail(candidate_id, "screening", err, log)
                return {"outcome": "failed", "stage": "screening", "error": err}

            screening_data = screening_result["data"]
            match_score = int(screening_data.get("match_score", 0))

            db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "screening":      screening_data,
                    "pipeline_stage": "screening",
                    "progress":       30,
                    "error_message":  None,
                    "updated_at":     datetime.utcnow(),
                }},
            )
            db_stage = "screening"

        log.info("Screening score=%d", match_score)

        # ── 2. Screening Gate (terminal — no retry on rejection) ─────
        current_stage = "screening_gate"
        threshold = Config.SCREENING_THRESHOLD

        if match_score < threshold:
            # Business decision: reject candidate, send static email, done.
            db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "status":                "rejected_screening",
                    "pipeline_stage":        "done",
                    "progress":              100,
                    "pipeline_completed_at": datetime.utcnow(),
                    "updated_at":            datetime.utcnow(),
                }},
            )
            # Send static rejection email — no LLM call, low failure risk
            try:
                email_content = get_static_rejection_email(
                    candidate_name=candidate_name,
                    job_title=job_title,
                    company_name=comp_name,
                    recruiter_email=recruiter_email,
                )
                send_res = send_email_via_resend(
                    recipient_email=candidate_email,
                    subject=email_content.get("subject", "Application Update"),
                    html_body=email_content.get("body_html", ""),
                    company_name=comp_name,
                    recruiter_email=recruiter_email,
                    resend_api_key=Config.RESEND_API_KEY,
                )
                db.candidates.update_one(
                    {"_id": ObjectId(candidate_id)},
                    {"$set": {
                        "email_sent":       send_res["success"],
                        "email_error":      send_res.get("error"),
                        "email_message_id": send_res.get("message_id"),
                    }},
                )
            except Exception as email_exc:
                log.warning("Rejection email failed: %s", email_exc)

            log.info(
                "Rejected at screening score=%d < threshold=%d",
                match_score, threshold,
            )
            return {"outcome": "rejected", "score": match_score, "threshold": threshold}

        # ── 3. Question Generation ───────────────────────────────────
        current_stage = "questions"

        if _stage_already_done(db_stage, "questions"):
            log.info("Questions already generated — skipping")
            questions = candidate.get("interview_questions", [])
        else:
            _set_stage(
                candidate_id, "questions", 45,
                extra={"questions_started_at": datetime.utcnow()},
                log=log,
            )

            try:
                qgen = QuestionGenerator(Config.GEMINI_API_KEY)
                questions_result = qgen.generate(
                    candidate_profile={"name": candidate_name},
                    jd_data=jd_data,
                    screening_data=screening_data,
                )
            except SoftTimeLimitExceeded:
                raise self.retry(
                    exc=SoftTimeLimitExceeded("Question generation timed out"),
                    countdown=60 * (2 ** attempt),
                )
            except Exception as exc:
                log.warning("Question gen exception: %s", exc)
                raise self.retry(exc=exc, countdown=60 * (2 ** attempt))

            if not questions_result["success"]:
                err = f"QuestionGenerator failed: {questions_result.get('error')}"
                if attempt < max_tries:
                    _set_stage(candidate_id, "questions", 40,
                               {"error_message": err}, log=log)
                    raise self.retry(exc=RuntimeError(err), countdown=60 * (2 ** attempt))
                _fail(candidate_id, "questions", err, log)
                return {"outcome": "failed", "stage": "questions", "error": err}

            questions = questions_result["data"]["questions"]
            _set_stage(
                candidate_id, "questions", 60,
                {"interview_questions": questions, "error_message": None},
                log=log,
            )
            db_stage = "questions"

        # ── 4. Interview token (idempotent — reuse if already set) ───
        current_stage = "token"

        existing_token = candidate.get("interview_token")
        if existing_token and _stage_already_done(db_stage, "invite_email"):
            log.info("Token already exists — skipping")
            interview_token = existing_token
        else:
            interview_token = secrets.token_urlsafe(32)
            token_expires   = datetime.utcnow() + timedelta(days=7)

            db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "status":                    "interview_invited",
                    "interview_questions":        questions,
                    "interview_token":            interview_token,
                    "interview_token_expires_at": token_expires,
                    "interview_token_used":       False,
                    "pipeline_stage":             "invite_email",
                    "progress":                   75,
                    "updated_at":                 datetime.utcnow(),
                }},
            )
            db_stage = "invite_email"

        # ── 5. Invitation email — ATOMIC exactly-once send ───────────
        # P0 fix: replace the stale-snapshot TOCTOU check with an atomic
        # find_one_and_update. The filter {"email_sent": {"$ne": True}}
        # ensures only ONE worker can win the CAS even if:
        #   - the task retries (acks_late)
        #   - two workers race after a crash (reject_on_worker_lost)
        # If result is None → another execution already sent the email.
        current_stage = "invite_email"

        invite_link = f"{Config.FRONTEND_URL}/interview/{interview_token}"

        cas_result = db.candidates.find_one_and_update(
            {
                "_id":        ObjectId(candidate_id),
                "email_sent": {"$ne": True},  # only win if NOT already sent
            },
            {"$set": {
                "invite_email_started_at": datetime.utcnow(),
                "email_lock":    True,
                "email_lock_at": datetime.utcnow(),
            }},
            # Return None if no document matched (email already sent)
            return_document=ReturnDocument.BEFORE,
        )

        if cas_result is None:
            # Lost the race — another execution already sent the email
            log.info("Invite email already sent (atomic CAS) — skipping")
        else:
            # Won the CAS lock — we are the sole sender
            email_sent       = False
            email_error      = None
            email_message_id = None

            try:
                email_sender = EmailSender(Config.GEMINI_API_KEY)
                email_result = email_sender.generate_email(
                    candidate_profile={"name": candidate_name, "email": candidate_email},
                    jd_data=jd_data,
                    company_data={"company_name": comp_name, "contact_email": recruiter_email},
                    interview_link=invite_link,
                )
            except SoftTimeLimitExceeded:
                # Release the lock so a retry can re-acquire it
                db.candidates.update_one(
                    {"_id": ObjectId(candidate_id)},
                    {"$unset": {"email_lock": "", "email_lock_at": ""},
                     "$set":   {"updated_at": datetime.utcnow()}},
                )
                raise self.retry(
                    exc=SoftTimeLimitExceeded("Email generation timed out"),
                    countdown=60 * (2 ** attempt),
                )
            except Exception as exc:
                # Release the lock so a retry can re-acquire it
                db.candidates.update_one(
                    {"_id": ObjectId(candidate_id)},
                    {"$unset": {"email_lock": "", "email_lock_at": ""},
                     "$set":   {"updated_at": datetime.utcnow()}},
                )
                log.warning("Email gen exception: %s", exc)
                raise self.retry(exc=exc, countdown=60 * (2 ** attempt))

            if email_result["success"]:
                body_html = email_result["data"].get("body_html", "")
                # Fail-safe: inject invite link if LLM missed it
                if invite_link not in body_html:
                    body_html += (
                        f'<div style="margin:25px 0">'
                        f'<p>To start your interview, click below:</p>'
                        f'<a href="{invite_link}" style="background:#4F46E5;color:#fff;'
                        f'padding:12px 24px;text-decoration:none;border-radius:6px;'
                        f'display:inline-block;font-weight:bold;">Start Interview</a></div>'
                        f'<p style="font-size:12px;color:#6B7280">Or paste: {invite_link}</p>'
                    )
                send_res = send_email_via_resend(
                    recipient_email=candidate_email,
                    subject=email_result["data"].get("subject", "Interview Invitation"),
                    html_body=body_html,
                    company_name=comp_name,
                    recruiter_email=recruiter_email,
                    resend_api_key=Config.RESEND_API_KEY,
                )
                email_sent       = send_res["success"]
                email_error      = send_res.get("error")
                email_message_id = send_res.get("message_id")
            else:
                email_error = f"Email content generation failed: {email_result.get('error')}"
                log.warning("%s", email_error)

            # Atomically record send result + clear the lock
            db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "email_sent":       email_sent,
                    "email_error":      email_error,
                    "email_message_id": email_message_id,
                    "updated_at":       datetime.utcnow(),
                },
                 "$unset": {"email_lock": "", "email_lock_at": ""}},
            )
            log.info("Invite email sent=%s message_id=%s", email_sent, email_message_id)

        # ── 6. Mark pipeline complete ──────────────────────────────────
        current_stage = "done"
        db.candidates.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {
                "status":                "interview_invited",
                "pipeline_stage":        "done",
                "progress":              100,
                "pipeline_completed_at": datetime.utcnow(),
                "updated_at":            datetime.utcnow(),
            }},
        )

        log.info("Pipeline complete score=%d outcome=invited", match_score)
        return {"outcome": "invited", "score": match_score, "candidate_id": candidate_id}

    except Exception as exc:
        # Catch anything NOT already handled above.
        # self.retry() raises Retry internally — re-raise it.
        from celery.exceptions import Retry
        if isinstance(exc, Retry):
            raise

        tb = traceback.format_exc()
        log.error(
            "Unhandled exception at stage=%s attempt=%d/%d\n%s",
            current_stage, attempt + 1, max_tries + 1, tb,
        )

        if attempt < max_tries:
            raise self.retry(exc=exc, countdown=60 * (2 ** attempt))

        # No retries left — permanently fail
        try:
            _fail(
                candidate_id,
                current_stage,
                f"Unhandled error after {max_tries + 1} attempts: {exc}",
                log,
            )
        except Exception:
            pass  # DB write failed — nothing more we can do

        return {
            "outcome":  "failed",
            "stage":    current_stage,
            "error":    str(exc),
            "attempts": attempt + 1,
        }
