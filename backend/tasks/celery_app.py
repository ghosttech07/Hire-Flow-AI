"""
backend/celery_app.py

HireFlow AI — Celery application factory.

Broker  : Redis db/0  (task queue)
Backend : Redis db/1  (result storage)

Usage
-----
# Start a worker (Windows-safe pool):
celery -A celery_app worker --pool=solo --loglevel=info -Q hireflow.pipeline

# Start Flower monitoring dashboard:
celery -A celery_app flower --port=5555

# Inspect active tasks:
celery -A celery_app inspect active

Import this module wherever you need to enqueue tasks:
    from celery_app import celery_app
"""

import os
from celery import Celery
from dotenv import load_dotenv
from kombu import Exchange, Queue

load_dotenv()

# ─────────────────────────────────────────────────────────────
# URLs — read from environment with sensible local defaults
# ─────────────────────────────────────────────────────────────
REDIS_BROKER  = os.getenv("REDIS_URL",              "redis://localhost:6379/0")
REDIS_BACKEND = os.getenv("CELERY_RESULT_BACKEND",  "redis://localhost:6379/1")

# ─────────────────────────────────────────────────────────────
# Queue definitions
# ─────────────────────────────────────────────────────────────
default_exchange = Exchange("hireflow", type="direct")

TASK_QUEUES = (
    # Standard pipeline queue
    Queue("hireflow.pipeline", default_exchange, routing_key="pipeline"),
    # High-priority queue for premium / expedited candidates
    Queue("hireflow.priority", default_exchange, routing_key="priority"),
)

TASK_ROUTES = {
    "pipeline.process_candidate_pipeline": {
        "queue":       "hireflow.pipeline",
        "routing_key": "pipeline",
    },
}

# ─────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────
def make_celery() -> Celery:
    app = Celery(
        "hireflow",
        broker=REDIS_BROKER,
        backend=REDIS_BACKEND,
        # Autodiscover tasks from this module path
        include=["pipeline.candidate_pipeline"],
    )

    app.conf.update(
        # ── Serialization ─────────────────────────────────────
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],

        # ── Reliability (most important settings) ─────────────
        # Only acknowledge a task AFTER it finishes successfully.
        # If the worker crashes mid-task, Redis keeps the message
        # and another worker (or the same, after restart) will
        # re-process it. Zero message loss.
        task_acks_late=True,
        # If a worker loses connection while running a task,
        # reject the message so it goes back to the queue.
        task_reject_on_worker_lost=True,
        # Fetch one task at a time per worker — fair dispatch,
        # prevents one slow task from hogging a worker slot.
        worker_prefetch_multiplier=1,

        # ── Time limits ────────────────────────────────────────
        # Soft limit: task receives SoftTimeLimitExceeded at 5 min
        # → can clean up and re-raise for retry.
        task_soft_time_limit=300,
        # Hard limit: worker process is killed at 6 min.
        task_time_limit=360,

        # ── Results ───────────────────────────────────────────
        # Keep task results in Redis for 24 h (useful for Flower).
        result_expires=86400,
        # Store exceptions so Flower can display failure reasons.
        task_store_errors_even_if_ignored=True,

        # ── Queues & routing ──────────────────────────────────
        task_queues=TASK_QUEUES,
        task_routes=TASK_ROUTES,
        task_default_queue="hireflow.pipeline",
        task_default_exchange="hireflow",
        task_default_routing_key="pipeline",

        # ── Monitoring ────────────────────────────────────────
        # Send task events so Flower can track them in real-time.
        worker_send_task_events=True,
        task_send_sent_event=True,

        # ── Misc ──────────────────────────────────────────────
        enable_utc=True,
        timezone="UTC",
        # Prevent huge Redis memory usage from storing giant results.
        # Pipeline tasks return None; we track state in MongoDB.
        task_ignore_result=False,
    )

    return app


celery_app = make_celery()
