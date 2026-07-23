import os
import logging
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv()
logger = logging.getLogger(__name__)

class Config:
    SECRET_KEY = os.getenv("JWT_SECRET")
    MONGO_URI = os.getenv("MONGO_URI")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    HIRE_THRESHOLD = float(os.getenv("HIRE_THRESHOLD", "70.0"))
    SCREENING_THRESHOLD = int(os.getenv("SCREENING_THRESHOLD", "50"))
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    # Celery / Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    # CORS — comma-separated list of allowed frontend origins
    ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://hire-flow-ai.vercel.app").split(",") if o.strip()]
    # JWT refresh token (separate secret from access token)
    JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", os.getenv("JWT_SECRET", ""))
    JWT_ACCESS_EXPIRES_HOURS = int(os.getenv("JWT_ACCESS_EXPIRES_HOURS", "8"))
    JWT_REFRESH_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_EXPIRES_DAYS", "30"))
    # Rate limiter uses its own Redis DB to avoid mixing with task queue
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "redis://localhost:6379/2")

    # Initialize PyMongo Client and database connection with mongomock fallback
    try:
        logger.info("Attempting connection to MongoDB Atlas...")
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000, tlsCAFile=certifi.where())
        # Trigger a robust check to verify the connection is fully operational
        _client.get_database("hireflow").list_collection_names()
        db = _client.get_database("hireflow")
        logger.info("✓ Connected to MongoDB Atlas successfully")
    except Exception as exc:
        logger.warning(f"MongoDB Atlas connection failed: {exc}. Falling back to mongomock.")
        import mongomock
        _client = mongomock.MongoClient()
        db = _client.get_database("hireflow")