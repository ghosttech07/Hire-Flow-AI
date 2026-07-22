"""
backend/middleware/auth.py
JWT authentication middleware for HireFlow AI.
"""

from functools import wraps
from flask import request, jsonify
import jwt
from config import Config
from services.jwt_utils import decode_token

def require_auth(f):
    """
    Decorator to protect routes with JWT authentication.
    Reads "Authorization: Bearer <token>" header.
    On success, sets request.company_id and request.company_email.
    On failure, returns 401.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401
            
        parts = auth_header.split(" ")
        if len(parts) != 2:
            return jsonify({"error": "Missing or invalid authorization header"}), 401
            
        token = parts[1]
        try:
            payload = decode_token(token, Config.SECRET_KEY)
            request.company_id = payload.get("company_id")
            request.company_email = payload.get("email")
            if not request.company_id:
                return jsonify({"error": "Invalid or expired token"}), 401
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({"error": "Invalid or expired token"}), 401
            
        return f(*args, **kwargs)
    return decorated
