"""
backend/init_db.py

Database initialization — creates all MongoDB indexes on startup.

Each index is created idempotently: if an old conflicting index with a
different name already exists in the DB, it is dropped first, then
recreated under the correct name. This makes the function safe to run
on every startup regardless of the DB's prior state.

Index strategy:
  - Unique indexes    : DB-level duplicate prevention
  - Sparse indexes    : skip docs without the field (saves space)
  - TTL indexes       : auto-delete expired docs (OTPs, locks, caches)
  - Compound indexes  : cover common query patterns
"""

import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import OperationFailure

logger = logging.getLogger(__name__)


def _safe_create_index(collection, *args, drop_if_conflict: str = None, **kwargs):
    """
    Create a MongoDB index. If an OperationFailure (IndexOptionsConflict)
    occurs and drop_if_conflict names the old index, drop it first then retry.
    """
    try:
        collection.create_index(*args, **kwargs)
    except OperationFailure:
        if drop_if_conflict:
            try:
                collection.drop_index(drop_if_conflict)
                logger.info(f"Dropped conflicting index '{drop_if_conflict}' on {collection.name}")
            except Exception:
                pass
            collection.create_index(*args, **kwargs)
        else:
            raise


def init_db(db) -> None:
    """
    Creates all required indexes for every collection.
    Called once inside create_app() before any requests are served.
    """
    try:
        logger.info("Initializing database indexes")

        # ── companies ─────────────────────────────────────────────────
        _safe_create_index(db.companies, "email", unique=True)
        logger.info("Index ready: companies.email (unique)")

        # ── otps ──────────────────────────────────────────────────────
        _safe_create_index(
            db.otps, "expires_at",
            expireAfterSeconds=0,
            name="ttl_otps_expires_at",
            drop_if_conflict="expires_at_1",
        )
        logger.info("Index ready: otps.expires_at (TTL)")

        # ── jobs ──────────────────────────────────────────────────────
        _safe_create_index(
            db.jobs, [("company_id", ASCENDING)],
            name="idx_jobs_company_id",
            drop_if_conflict="company_id_1",
        )
        logger.info("Index ready: jobs.company_id")

        # ── candidates ────────────────────────────────────────────────
        _safe_create_index(
            db.candidates,
            [("candidate_email", ASCENDING), ("job_id", ASCENDING)],
            unique=True,
            name="unique_candidate_per_job",
        )
        logger.info("Index ready: candidates.(candidate_email, job_id) [UNIQUE]")

        _safe_create_index(
            db.candidates, [("company_id", ASCENDING)],
            name="idx_candidates_company_id",
            drop_if_conflict="company_id_1",
        )
        _safe_create_index(
            db.candidates, [("job_id", ASCENDING)],
            name="idx_candidates_job_id",
            drop_if_conflict="job_id_1",
        )
        _safe_create_index(
            db.candidates, [("status", ASCENDING)],
            name="idx_candidates_status",
            drop_if_conflict="status_1",
        )
        _safe_create_index(
            db.candidates, [("interview_token", ASCENDING)],
            sparse=True,
            name="idx_candidates_interview_token",
            drop_if_conflict="interview_token_1",
        )
        _safe_create_index(
            db.candidates, [("celery_task_id", ASCENDING)],
            sparse=True,
            name="idx_candidates_celery_task_id",
            drop_if_conflict="celery_task_id_1",
        )
        _safe_create_index(
            db.candidates, "email_lock_at",
            expireAfterSeconds=900,
            sparse=True,
            name="ttl_candidates_email_lock",
            drop_if_conflict="email_lock_at_1",
        )
        logger.info("Index ready: candidates (all indexes)")

        # ── llm_cache ─────────────────────────────────────────────────
        _safe_create_index(
            db.llm_cache, "created_at",
            expireAfterSeconds=604800,
            name="ttl_llm_cache_created_at",
        )
        _safe_create_index(
            db.llm_cache,
            [("key", ASCENDING), ("agent", ASCENDING)],
            unique=True,
            name="unique_llm_cache_key_agent",
        )
        logger.info("Index ready: llm_cache (TTL + unique key)")

        # ── refresh_tokens ────────────────────────────────────────────
        _safe_create_index(
            db.refresh_tokens, "expires_at",
            expireAfterSeconds=0,
            name="ttl_refresh_tokens_expires_at",
        )
        _safe_create_index(
            db.refresh_tokens, [("company_id", ASCENDING)],
            name="idx_refresh_tokens_company_id",
        )
        logger.info("Index ready: refresh_tokens (TTL + company_id)")

        # ── audit_log ─────────────────────────────────────────────────
        _safe_create_index(
            db.audit_log,
            [("entity_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_audit_entity_created",
        )
        logger.info("Index ready: audit_log (entity_id, created_at)")

        logger.info("Database initialization complete")

    except Exception as e:
        logger.error("Database initialization failed", exc_info=True)
