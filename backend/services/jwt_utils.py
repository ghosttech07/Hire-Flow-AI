"""
backend/auth/jwt_utils.py

JWT utilities for HireFlow AI.

Tokens
──────
Access token  — short-lived (default 8h), sent with every API request
Refresh token — long-lived (default 30d), used ONLY to issue new access tokens

Both tokens are HS256-signed.  Access and refresh tokens use DIFFERENT secrets
so that a compromised access token cannot be used to mint new tokens.

Refresh token lifecycle:
  1. Login → DB record inserted in `refresh_tokens` collection
  2. POST /api/auth/refresh → verify token + DB record → issue new access token
  3. Logout / revoke → DB record deleted

The `refresh_tokens` collection has a TTL index on `expires_at` so MongoDB
automatically cleans up expired tokens.
"""

import jwt
import secrets
from datetime import datetime, timedelta


# ── Access tokens ──────────────────────────────────────────────────────────

def generate_token(company_id: str, email: str, secret: str,
                   expires_hours: int = 8) -> str:
    """
    Generate a short-lived access token.

    Payload: {company_id, email, iat, exp, type="access"}
    """
    payload = {
        "company_id": company_id,
        "email":      email,
        "iat":        datetime.utcnow(),
        "exp":        datetime.utcnow() + timedelta(hours=expires_hours),
        "type":       "access",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    """
    Decode and validate an access token.

    Raises:
        jwt.ExpiredSignatureError  — token has expired
        jwt.InvalidTokenError      — signature invalid or malformed
        ValueError                 — token is a refresh token (wrong type)
    """
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    if payload.get("type") == "refresh":
        raise ValueError("Refresh tokens cannot be used as access tokens")
    return payload


# ── Refresh tokens ─────────────────────────────────────────────────────────

def generate_refresh_token(company_id: str, email: str, refresh_secret: str,
                            expires_days: int = 30) -> tuple[str, datetime]:
    """
    Generate a long-lived refresh token.

    Returns:
        (token_string, expires_at_datetime)

    The caller is responsible for storing the token and expires_at in MongoDB.
    """
    expires_at = datetime.utcnow() + timedelta(days=expires_days)
    payload = {
        "company_id": company_id,
        "email":      email,
        "iat":        datetime.utcnow(),
        "exp":        expires_at,
        "type":       "refresh",
        # jti (JWT ID) is a unique identifier so each token can be individually revoked
        "jti":        secrets.token_hex(16),
    }
    token = jwt.encode(payload, refresh_secret, algorithm="HS256")
    return token, expires_at


def decode_refresh_token(token: str, refresh_secret: str) -> dict:
    """
    Decode and validate a refresh token.

    Raises:
        jwt.ExpiredSignatureError  — token has expired
        jwt.InvalidTokenError      — signature invalid or malformed
        ValueError                 — token is an access token (wrong type)
    """
    payload = jwt.decode(token, refresh_secret, algorithms=["HS256"])
    if payload.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")
    return payload
