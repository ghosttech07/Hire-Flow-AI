"""
backend/extensions.py

Shared Flask extensions — instantiated once here, initialized
with the app inside create_app() via the init_app() pattern.

This prevents circular imports between app.py and blueprints
that need access to the limiter.
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Rate limiter — storage_uri is set from app config (RATELIMIT_STORAGE_URI)
# during limiter.init_app(app) in create_app().
limiter = Limiter(
    key_func=get_remote_address,
    # Conservative global defaults — individual routes can override stricter limits.
    default_limits=["500 per day", "100 per hour"],
    # Don't raise on Redis unavailability — fail open (allow request through)
    # rather than block all traffic when Redis is down.
    on_breach=None,
)
