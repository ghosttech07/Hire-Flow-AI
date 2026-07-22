"""
Middleware registration.
"""

from flask import Flask


def register_middleware(app: Flask) -> None:
    """
    Register middleware.

    Phase 1:
    No global middleware is required yet.
    JWT authentication will be applied using decorators.
    """

    @app.before_request
    def before_request():
        pass

    print("✓ Middleware registered.")