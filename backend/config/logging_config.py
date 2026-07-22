"""
backend/logging_config.py

Structured JSON logging for HireFlow AI.

Every log line is a single JSON object — grep-friendly and
compatible with log aggregators (Datadog, CloudWatch, Loki).

Usage:
    from logging_config import configure_logging
    configure_logging()   # call once in create_app()

Per-request context (candidate_id, task_id, stage) is injected
via logging.LoggerAdapter in the pipeline and blueprints:

    log = logging.LoggerAdapter(logger, {"candidate_id": cid, "stage": "screening"})
    log.info("Screening started")
    # → {"ts":"...","level":"INFO","candidate_id":"abc123","stage":"screening","msg":"Screening started"}
"""

import json
import logging
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit one compact JSON object per log record."""

    # Fields that LoggerAdapters / extra= dicts may inject
    CONTEXT_FIELDS = ("candidate_id", "task_id", "stage", "company_id", "job_id")

    def format(self, record: logging.LogRecord) -> str:
        doc: dict = {
            "ts":      datetime.now(tz=timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
        }

        # Pull optional context fields added via extra={}
        for field in self.CONTEXT_FIELDS:
            val = getattr(record, field, None)
            if val is not None:
                doc[field] = val

        # Attach exception traceback if present
        if record.exc_info:
            doc["exc"] = self.formatException(record.exc_info)

        return json.dumps(doc, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """
    Replace the root logger's handlers with a single JSON-to-stdout handler.
    Call once at application startup (inside create_app).
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Silence noisy third-party loggers
    for name in ("pymongo", "urllib3", "httpx", "celery.app.trace"):
        logging.getLogger(name).setLevel(logging.WARNING)
