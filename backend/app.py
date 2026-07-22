from flask import Flask, request
from flask_cors import CORS
from config import Config
from db.init_db import init_db
from config.logging_config import configure_logging
from config.extensions import limiter
import logging

logger = logging.getLogger(__name__)


def create_app():
    """Flask application factory"""

    # ── Structured JSON logging (must be first) ────────────────────────
    configure_logging(level=Config.LOG_LEVEL)

    app = Flask(__name__)
    app.config.from_object(Config)

    # ── Pass Flask-Limiter storage URI from config ─────────────────────
    # Flask-Limiter reads RATELIMIT_STORAGE_URI from the Flask app config.
    app.config["RATELIMIT_STORAGE_URI"] = Config.RATELIMIT_STORAGE_URI
    # Don't count 4xx/5xx responses against the rate limit (only count valid hits)
    app.config["RATELIMIT_HEADERS_ENABLED"] = True

    # ── CORS — restricted to configured origins only ───────────────────
    # NEVER use origins="*" in a B2B SaaS with JWT auth.
    # Set ALLOWED_ORIGINS=https://app.yourdomain.com in production .env.
    CORS(app, resources={r"/api/*": {
        "origins":       Config.ALLOWED_ORIGINS,
        "allow_headers": ["Content-Type", "Authorization"],
        "methods":       ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        # supports_credentials=True is required if you ever switch to
        # cookie-based auth. For JWT header auth it has no effect.
        "supports_credentials": True,
    }})

    # ── Rate limiter ───────────────────────────────────────────────────
    limiter.init_app(app)

    logger.info("HireFlow AI backend starting", extra={"allowed_origins": Config.ALLOWED_ORIGINS})

    # ── Database ───────────────────────────────────────────────────────
    init_db(Config.db)

    # ── Routes (Blueprints) ────────────────────────────────────────────
    from routes.jobs import jobs_bp
    from routes.auth import auth_bp
    from routes.apply import apply_bp
    from routes.interview import interview_bp
    from routes.result import result_bp
    app.register_blueprint(jobs_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(apply_bp)
    app.register_blueprint(interview_bp)
    app.register_blueprint(result_bp)

    # ── Dashboard stats ────────────────────────────────────────────────
    @app.route('/api/dashboard-stats', methods=['GET'])
    def get_dashboard_stats():
        from middleware.auth import require_auth

        @require_auth
        def fetch_stats():
            try:
                company_id = request.company_id
                db = Config.db

                candidates = list(db.candidates.find({"company_id": company_id}))

                applicants = screening = interviews = offers = 0

                for cand in candidates:
                    status = cand.get("status")
                    applicants += 1
                    if status not in ["applied", "rejected_screening", "screening_failed"]:
                        screening += 1
                    if status in ["interview_completed", "offer_sent", "rejected_final"]:
                        interviews += 1
                    if status == "offer_sent":
                        offers += 1

                return {
                    "applicants": applicants,
                    "screening":  screening,
                    "interviews": interviews,
                    "offers":     offers,
                }, 200
            except Exception as e:
                logger.error("Error fetching dashboard stats", exc_info=True)
                return {"error": "Internal server error"}, 500

        return fetch_stats()

    # ── Health check ───────────────────────────────────────────────────
    @app.route('/api/health', methods=['GET'])
    def health():
        redis_ok = False
        try:
            import redis as _redis
            r = _redis.from_url(Config.REDIS_URL, socket_connect_timeout=1)
            r.ping()
            redis_ok = True
        except Exception:
            pass

        mongo_ok = False
        try:
            Config.db.command("ping")
            mongo_ok = True
        except Exception:
            pass

        status = "ok" if (redis_ok and mongo_ok) else "degraded"
        return {
            "status":  status,
            "version": "0.2.0",
            "redis":   redis_ok,
            "mongo":   mongo_ok,
        }, 200 if status == "ok" else 503

    # ── Error handlers ─────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return {"success": False, "error": "Not found"}, 404

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return {
            "success": False,
            "error": "Too many requests. Please slow down.",
            "retry_after": str(e.description),
        }, 429

    @app.errorhandler(500)
    def internal_error(e):
        logger.error("Internal server error", exc_info=True)
        return {"success": False, "error": "Internal server error"}, 500

    logger.info("Flask app created successfully")
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000, host='0.0.0.0')