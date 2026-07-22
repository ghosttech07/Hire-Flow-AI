"""
backend/blueprints/apply.py

Public candidate application endpoints.

POST /api/apply/<job_id>/submit
  - Validates form data and PDF
  - Extracts resume text
  - Inserts candidate document with status="processing"
  - Enqueues Celery task (process_candidate_pipeline.delay)
  - Returns 202 immediately with candidate_id + celery_task_id
  - Returns 409 if candidate already applied to this job

GET /api/apply/<job_id>
  - Public job info (unchanged)

GET /api/apply/status/<candidate_id>
  - Polling endpoint: returns current status, pipeline_stage, progress

GET /api/apply/stream/<candidate_id>  [NEW]
  - Server-Sent Events: pushes live updates until pipeline completes
"""

import json
import logging
import secrets
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, Response, stream_with_context
from bson.objectid import ObjectId
from pymongo.errors import DuplicateKeyError

from config import Config
from utils.resume_extractor import extract_text_from_pdf, extract_photo_from_pdf, extract_name_from_resume_text
from pipeline.candidate_pipeline import process_candidate_pipeline
from config.extensions import limiter

logger = logging.getLogger(__name__)

apply_bp = Blueprint('apply', __name__, url_prefix='/api/apply')
db = Config.db


# ──────────────────────────────────────────────────────────────
# GET /api/apply/<job_id>  — public job preview (unchanged)
# ──────────────────────────────────────────────────────────────

@apply_bp.route('/<job_id>', methods=['GET'])
def get_job_info(job_id):
    """
    Public endpoint: return basic job info for the application page.
    No auth required.
    """
    try:
        try:
            job_oid = ObjectId(job_id)
        except Exception:
            return jsonify({"success": False, "error": "Job not found"}), 404

        job = db.jobs.find_one({"_id": job_oid})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404

        company_name = "Our Company"
        company_id = job.get("company_id")
        if company_id:
            try:
                comp = db.companies.find_one({"_id": ObjectId(company_id)})
                if comp:
                    company_name = comp.get("company_name", "Our Company")
            except Exception as exc:
                logger.warning("Company lookup failed: %s", exc)

        parsed = job.get("parsed", {})
        return jsonify({
            "job_title":        parsed.get("job_title", "Unknown Role"),
            "company_name":     company_name,
            "seniority_level":  parsed.get("seniority_level", "mid"),
            "responsibilities": parsed.get("responsibilities", []),
            "required_skills":  parsed.get("required_skills", []),
        }), 200

    except Exception as exc:
        logger.error("Error in get_job_info: %s", exc, exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500


# ──────────────────────────────────────────────────────────────
# POST /api/apply/<job_id>/submit  — async application entry
# ──────────────────────────────────────────────────────────────

@apply_bp.route('/<job_id>/submit', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def submit_application(job_id):
    """
    Accept a candidate application, insert the document, enqueue a Celery
    task, and return 202 immediately. The Celery worker runs the AI pipeline.

    Rate-limited: 5 submissions per minute, 20 per hour per IP.

    Response:
        202  { "status": "processing", "candidate_id": "<id>", "celery_task_id": "<id>" }
        400  Validation error
        404  Job not found
        409  Already applied (same email + job)
        429  Rate limit exceeded
        500  Internal error
    """
    try:
        # ── Job lookup ────────────────────────────────────────────────
        try:
            job_oid = ObjectId(job_id)
        except Exception:
            return jsonify({"success": False, "error": "Job not found"}), 404

        job = db.jobs.find_one({"_id": job_oid})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404

        company_id = job.get("company_id")

        # ── Form validation ───────────────────────────────────────────
        name  = request.form.get("name",  "").strip()
        email = request.form.get("email", "").strip()

        if not name or not email:
            return jsonify({"success": False, "error": "name and email are required"}), 400

        if 'resume' not in request.files:
            return jsonify({"success": False, "error": "resume file is required"}), 400

        resume_file = request.files['resume']

        if not resume_file.filename:
            return jsonify({"success": False, "error": "resume file is required"}), 400

        # Validate PDF
        if (resume_file.mimetype != 'application/pdf'
                and not resume_file.filename.lower().endswith('.pdf')):
            return jsonify({"success": False, "error": "Only PDF resumes are supported"}), 400

        # 5 MB size limit
        resume_data = resume_file.read()
        if len(resume_data) > 5 * 1024 * 1024:
            return jsonify({"success": False, "error": "Resume file size exceeds the 5 MB limit"}), 400

        resume_file.seek(0)

        # ── PDF text + photo extraction (synchronous — fast) ────────────
        try:
            resume_text = extract_text_from_pdf(resume_file)
        except ValueError as ve:
            return jsonify({"success": False, "error": str(ve)}), 400

        # Best-effort photo extraction — never blocks the submission
        photo_base64 = extract_photo_from_pdf(resume_data)

        # Extract the real name from the resume (use entered name as fallback)
        resume_name = extract_name_from_resume_text(resume_text, fallback=name)

        # ── Insert candidate document (status = processing) ───────────
        apply_token = secrets.token_urlsafe(16)
        candidate_doc = {
            "company_id":                company_id,
            "job_id":                    job_id,
            "candidate_name":            name,          # as entered in the form
            "resume_name":               resume_name,   # parsed from the resume text
            "candidate_email":           email,
            "resume_text":               resume_text,
            "photo_base64":              photo_base64,
            # lifecycle state
            "status":                    "processing",
            "pipeline_stage":            "queued",
            "progress":                  5,
            "error_message":             None,
            # timestamps
            "applied_at":                datetime.utcnow(),
            "created_at":                datetime.utcnow(),
            "updated_at":                datetime.utcnow(),
            "pipeline_started_at":       None,
            "pipeline_completed_at":     None,
            # interview fields (populated by pipeline)
            "resume_source":             "pdf",
            "apply_token":               apply_token,
            "interview_token":           None,
            "interview_token_expires_at": None,
            "interview_token_used":      False,
            "interview_questions":       [],
            # email tracking (populated by pipeline)
            "email_sent":                False,
            "email_error":               None,
            "email_message_id":          None,
        }

        db_result = db.candidates.insert_one(candidate_doc)
        candidate_id = str(db_result.inserted_id)

        # ── Enqueue Celery task ───────────────────────────────────────
        # .delay() is non-blocking: returns immediately after pushing
        # the task to Redis. The Celery worker picks it up asynchronously.
        task = process_candidate_pipeline.apply_async(
            args=[candidate_id, job_id],
            queue="hireflow.pipeline",
            # Retry-safe: acks_late=True is set on the task itself,
            # so no extra options needed here.
        )

        # Store Celery task ID for Flower traceability
        db.candidates.update_one(
            {"_id": db_result.inserted_id},
            {"$set": {"celery_task_id": task.id}},
        )

        logger.info(
            "Application accepted for %s (job=%s, candidate=%s) — Celery task %s enqueued",
            name, job_id, candidate_id, task.id,
        )

        # ── Return immediately ────────────────────────────────────────
        return jsonify({
            "status":         "processing",
            "candidate_id":   candidate_id,
            "celery_task_id": task.id,
            "message":        "Application received. AI screening is running in the background.",
        }), 202

    except DuplicateKeyError:
        # P0-4: Unique index on (candidate_email, job_id) fired.
        # The candidate already applied to this job. Return 409 cleanly.
        logger.info(
            "Duplicate application attempt: email=%s job=%s",
            request.form.get("email", ""), job_id,
        )
        return jsonify({
            "success": False,
            "error":   "You have already applied for this position.",
            "code":    "duplicate_application",
        }), 409

    except Exception as exc:
        logger.error("Error in submit_application", exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500


# ──────────────────────────────────────────────────────────────
# GET /api/apply/status/<candidate_id>  — polling endpoint
# ──────────────────────────────────────────────────────────────

@apply_bp.route('/status/<candidate_id>', methods=['GET'])
def get_pipeline_status(candidate_id):
    """
    Polling endpoint used by the frontend to track pipeline progress.

    Response shape:
        {
            "candidate_id":   "...",
            "status":         "processing | interview_invited | rejected_screening | failed",
            "pipeline_stage": "queued | screening | questions | invite_email | done",
            "progress":       0–100,
            "error_message":  null | "string",
            "interview_ready": true | false
        }
    """
    try:
        try:
            cand_oid = ObjectId(candidate_id)
        except Exception:
            return jsonify({"success": False, "error": "Invalid candidate ID"}), 400

        candidate = db.candidates.find_one(
            {"_id": cand_oid},
            # only fetch the fields we need — keep response lean
            {"status": 1, "pipeline_stage": 1, "progress": 1, "error_message": 1},
        )
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404

        status         = candidate.get("status", "processing")
        pipeline_stage = candidate.get("pipeline_stage", "queued")
        progress       = candidate.get("progress", 0)
        error_message  = candidate.get("error_message")

        # Convenience flag for the frontend
        interview_ready = status in ("interview_invited",)

        return jsonify({
            "candidate_id":   candidate_id,
            "status":         status,
            "pipeline_stage": pipeline_stage,
            "progress":       progress,
            "error_message":  error_message,
            "interview_ready": interview_ready,
        }), 200

    except Exception as exc:
        logger.error("Error in get_pipeline_status", exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500


# ──────────────────────────────────────────────────────────────
# GET /api/apply/stream/<candidate_id>  — Server-Sent Events [NEW]
# ──────────────────────────────────────────────────────────────

# Human-readable label for each pipeline stage
_STAGE_LABEL = {
    "queued":       "Queued for screening",
    "screening":    "Screening your resume…",
    "questions":    "Generating interview questions…",
    "invite_email": "Sending your interview invitation…",
    "done":         "Complete!",
}

# Statuses that mean the pipeline is finished (stream should close)
_TERMINAL_STATUSES = frozenset({
    "interview_invited",
    "rejected_screening",
    "failed",
    "offer_sent",
    "rejected_final",
})


@apply_bp.route('/stream/<candidate_id>', methods=['GET'])
@limiter.limit("30 per minute")
def stream_pipeline_status(candidate_id):
    """
    GET /api/apply/stream/<candidate_id>

    Server-Sent Events (SSE) endpoint.
    Streams real-time pipeline progress until the pipeline reaches a
    terminal state (invited / rejected / failed) or times out (5 min).

    Each event is a JSON object:
        {"status", "pipeline_stage", "stage_label", "progress",
         "error_message", "interview_ready"}

    The stream sends a named 'done' event when complete, so the frontend
    can close the EventSource cleanly.

    Scaling note:
        Each SSE connection holds an HTTP connection for up to 5 minutes.
        Run Flask with gunicorn + gevent workers for production:
        gunicorn app:create_app() --worker-class gevent --workers 4
    """
    try:
        cand_oid = ObjectId(candidate_id)
    except Exception:
        return jsonify({"error": "Invalid candidate ID"}), 400

    def generate():
        last_stage = None
        poll_interval = 2          # seconds between DB polls
        max_polls     = 150        # 150 × 2s = 5 minutes max

        for _ in range(max_polls):
            try:
                cand = db.candidates.find_one(
                    {"_id": cand_oid},
                    {"status": 1, "pipeline_stage": 1,
                     "progress": 1, "error_message": 1},
                )

                if not cand:
                    # Candidate not found — close stream
                    yield (
                        "event: error\n"
                        'data: {"error": "candidate_not_found"}\n\n'
                    )
                    return

                stage   = cand.get("pipeline_stage", "queued")
                status  = cand.get("status", "processing")
                progress = cand.get("progress", 0)

                # Only push when the stage changes (reduces noise)
                if stage != last_stage:
                    payload = json.dumps({
                        "status":          status,
                        "pipeline_stage":  stage,
                        "stage_label":     _STAGE_LABEL.get(stage, stage),
                        "progress":        progress,
                        "error_message":   cand.get("error_message"),
                        "interview_ready": status == "interview_invited",
                    })
                    yield f"data: {payload}\n\n"
                    last_stage = stage

                # Terminal state — send a named 'done' event and close
                if status in _TERMINAL_STATUSES:
                    final = json.dumps({
                        "status":          status,
                        "pipeline_stage":  stage,
                        "stage_label":     _STAGE_LABEL.get(stage, "Done"),
                        "progress":        progress,
                        "interview_ready": status == "interview_invited",
                    })
                    yield f"event: done\ndata: {final}\n\n"
                    return

            except GeneratorExit:
                # Client disconnected cleanly
                return
            except Exception as exc:
                logger.error(
                    "SSE stream error for candidate %s: %s", candidate_id[:8], exc
                )
                yield (
                    f'event: error\ndata: {{"error": "stream_error"}}\n\n'
                )
                return

            time.sleep(poll_interval)

        # 5-minute timeout reached
        yield 'event: timeout\ndata: {"error": "pipeline_timeout"}\n\n'

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            # Prevent any proxy or CDN from buffering the stream
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",     # Nginx: disable proxy buffering
            "Connection":        "keep-alive",
        },
    )
