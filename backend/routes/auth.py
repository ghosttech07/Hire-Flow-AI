"""
backend/blueprints/auth.py
Flask blueprint for authentication endpoints.
"""

import logging
import bcrypt
from datetime import datetime
from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from config import Config
from services.auth_service import (
    register_company,
    verify_otp_and_create_company,
    login_company,
    resend_otp
)
from services.jwt_utils import generate_token, generate_refresh_token, decode_refresh_token
from middleware.auth import require_auth
def to_public_company(company: dict) -> dict:
    """Convert a company MongoDB document to a public-safe dict."""
    if not company:
        return {}
    public = dict(company)
    public.pop("password", None)
    if "_id" in public:
        public["company_id"] = str(public["_id"])
        public["_id"] = str(public["_id"])
    return public
from config.extensions import limiter
import jwt

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
db = Config.db

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def register():
    """
    POST /api/auth/register
    Body: {"email": "...", "password": "...", "company_name": "...", "full_name": "..."}
    Rate-limited: 5 per minute, 20 per hour per IP.
    """
    try:
        data = request.get_json() or {}
        email = data.get('email')
        password = data.get('password')
        company_name = data.get('company_name')
        full_name = data.get('full_name')
        
        if not all([email, password, company_name, full_name]):
            return jsonify({"error": "Missing required fields"}), 400
            
        register_company(db, email, password, company_name, full_name)
        return jsonify({"message": "OTP sent to email"}), 200
    except ValueError as e:
        logger.warning(f"Registration validation error for {email}: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error registering company {email}: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """
    POST /api/auth/verify-otp
    Body: {"email": "...", "otp": "..."}
    """
    try:
        data = request.get_json() or {}
        email = data.get('email')
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({"error": "Missing email or OTP"}), 400
            
        result = verify_otp_and_create_company(db, email, otp)
        return jsonify(result), 201
    except ValueError as e:
        logger.warning(f"OTP verification failed for {email}: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error verifying OTP for {email}: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/resend-otp', methods=['POST'])
@limiter.limit("3 per minute; 10 per hour")
def resend_otp_route():
    """
    POST /api/auth/resend-otp
    Body: {"email": "..."}
    """
    try:
        data = request.get_json() or {}
        email = data.get('email')
        
        if not email:
            return jsonify({"error": "Missing email"}), 400
            
        result = resend_otp(db, email)
        return jsonify(result), 200
    except ValueError as e:
        logger.warning(f"Resend OTP failed for {email}: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error resending OTP for {email}: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute; 50 per hour")
def login():
    """
    POST /api/auth/login
    Body: {"email": "...", "password": "..."}
    Rate-limited: 10 per minute per IP (brute-force protection).
    Issues both an access token and a refresh token.
    """
    try:
        data = request.get_json() or {}
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Missing email or password"}), 400

        result = login_company(db, email, password)

        # Issue refresh token and store in DB for revocation support
        refresh_token, expires_at = generate_refresh_token(
            company_id=result["company_id"],
            email=email,
            refresh_secret=Config.JWT_REFRESH_SECRET,
            expires_days=Config.JWT_REFRESH_EXPIRES_DAYS,
        )
        db.refresh_tokens.insert_one({
            "company_id": result["company_id"],
            "email":      email,
            "token":      refresh_token,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "revoked":    False,
        })

        return jsonify({
            **result,
            "refresh_token": refresh_token,
        }), 200
    except ValueError as e:
        logger.warning("Login failed for %s: %s", email, e)
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        logger.error("Error logging in %s", email, exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    """
    PUT /api/auth/profile
    Protected. Update company profile (name, industry, team size).
    """
    try:
        company_id = request.company_id
        data = request.get_json() or {}
        
        update_fields = {}
        if 'company_name' in data:
            update_fields['company_name'] = data['company_name'].strip()
        if 'industry' in data:
            update_fields['industry'] = data['industry'].strip()
        if 'team_size' in data:
            update_fields['team_size'] = data['team_size'].strip()
            
        if not update_fields:
            return jsonify({"error": "No update fields provided"}), 400
            
        db.companies.update_one(
            {"_id": ObjectId(company_id)},
            {"$set": update_fields}
        )
        
        updated_company = db.companies.find_one({"_id": ObjectId(company_id)})
        return jsonify(to_public_company(updated_company)), 200
        
    except Exception as e:
        logger.error(f"Error updating profile: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route('/me', methods=['GET'])
@require_auth
def me():
    """
    GET /api/auth/me
    Protected. Returns public profile of current company.
    """
    try:
        company_id = request.company_id
        company = db.companies.find_one({"_id": ObjectId(company_id)})
        if not company:
            return jsonify({"error": "Company not found"}), 404
            
        return jsonify(to_public_company(company)), 200
    except Exception as e:
        logger.error(f"Error fetching profile: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500





@auth_bp.route('/set-password', methods=['POST'])
@require_auth
def set_password():
    """
    POST /api/auth/set-password
    Protected. Allows a Google-auth user to set a password for email+password login.
    Body: {"password": "..."}
    """
    try:
        company_id = request.company_id
        data = request.get_json() or {}
        password = data.get('password', '').strip()

        if not password:
            return jsonify({"error": "Password is required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        db.companies.update_one(
            {"_id": ObjectId(company_id)},
            {"$set": {"password": hashed, "has_password": True, "updated_at": datetime.utcnow()}}
        )
        logger.info(f"Password set for company {company_id}")
        return jsonify({"success": True, "message": "Password set successfully"}), 200

    except Exception as e:
        logger.error(f"Error setting password: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route('/change-password', methods=['POST'])
@require_auth
def change_password():
    """
    POST /api/auth/change-password
    Protected. Change existing password.
    Body: {"current_password": "...", "new_password": "..."}
    """
    try:
        company_id = request.company_id
        data = request.get_json() or {}
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '').strip()

        if not new_password or len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters"}), 400

        company = db.companies.find_one({"_id": ObjectId(company_id)})
        if not company:
            return jsonify({"error": "User not found"}), 404

        existing_hash = company.get('password', '')
        if existing_hash:
            # User has existing password — verify it first
            if not current_password:
                return jsonify({"error": "Current password is required"}), 400
            if not bcrypt.checkpw(current_password.encode('utf-8'), existing_hash.encode('utf-8')):
                return jsonify({"error": "Current password is incorrect"}), 401

        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        db.companies.update_one(
            {"_id": ObjectId(company_id)},
            {"$set": {"password": new_hash, "has_password": True, "updated_at": datetime.utcnow()}}
        )
        logger.info("Password changed for company %s", company_id)
        return jsonify({"success": True, "message": "Password changed successfully"}), 200

    except Exception as e:
        logger.error("Error changing password", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route('/refresh', methods=['POST'])
@limiter.limit("20 per minute")
def refresh_token_endpoint():
    """
    POST /api/auth/refresh
    Body: {"refresh_token": "<token>"}

    Validates the refresh token against the database (allows revocation),
    then issues a fresh access token.

    Response:
        200  {"token": "<new_access_token>"}
        401  Invalid, expired, or revoked token
    """
    try:
        data = request.get_json() or {}
        raw_refresh = data.get("refresh_token", "").strip()

        if not raw_refresh:
            return jsonify({"error": "refresh_token is required"}), 400

        # Step 1: Verify JWT signature + expiry
        try:
            payload = decode_refresh_token(raw_refresh, Config.JWT_REFRESH_SECRET)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Refresh token has expired. Please log in again."}), 401
        except (jwt.InvalidTokenError, ValueError) as e:
            return jsonify({"error": f"Invalid refresh token: {e}"}), 401

        company_id = payload.get("company_id")
        email      = payload.get("email")

        # Step 2: Check DB record (handles revocation + replay protection)
        token_doc = db.refresh_tokens.find_one({
            "token":      raw_refresh,
            "company_id": company_id,
            "revoked":    False,
        })
        if not token_doc:
            # Token not in DB: either revoked or was never issued by us
            logger.warning(
                "Refresh token not found or revoked for company %s", company_id
            )
            return jsonify({"error": "Refresh token is invalid or has been revoked."}), 401

        # Step 3: Issue new access token
        new_access_token = generate_token(
            company_id=company_id,
            email=email,
            secret=Config.SECRET_KEY,
            expires_hours=Config.JWT_ACCESS_EXPIRES_HOURS,
        )

        logger.info("Access token refreshed for company %s", company_id)
        return jsonify({"token": new_access_token}), 200

    except Exception as e:
        logger.error("Error refreshing token", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """
    POST /api/auth/logout
    Protected. Revokes the provided refresh token.
    Body: {"refresh_token": "<token>"}

    The access token cannot be revoked (it will expire naturally).
    """
    try:
        data = request.get_json() or {}
        raw_refresh = data.get("refresh_token", "").strip()

        if raw_refresh:
            db.refresh_tokens.update_one(
                {"token": raw_refresh, "company_id": request.company_id},
                {"$set": {"revoked": True, "revoked_at": datetime.utcnow()}},
            )

        logger.info("Logout for company %s", request.company_id)
        return jsonify({"success": True, "message": "Logged out successfully"}), 200

    except Exception as e:
        logger.error("Error during logout", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route('/google', methods=['POST'])
@limiter.limit("10 per minute")
def google_login():
    """POST /api/auth/google — Verify Google ID token and sign in."""
    print("🔥 GOOGLE AUTH HIT")
    req_json = request.get_json(silent=True) or {}
    print("Request JSON:", req_json)
    logger.info("Google auth route hit - POST /api/auth/google")
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        data = req_json
        # Accept 'token' or 'credential'
        google_token = data.get('token') or data.get('credential')
        if not google_token:
            print("❌ No token provided in request body")
            logger.warning("Google auth route hit but no token provided in request body")
            return jsonify({"error": "Missing token"}), 400

        client_id = Config.GOOGLE_CLIENT_ID
        if not client_id:
            print("❌ GOOGLE_CLIENT_ID is not configured")
            logger.error("GOOGLE_CLIENT_ID is not configured in environment")
            return jsonify({"error": "Google login is not configured on this server"}), 500

        # ── Verify token with Google (server-side, never trust frontend) ──
        try:
            idinfo = id_token.verify_oauth2_token(
                google_token,
                google_requests.Request(),
                client_id,
            )
        except ValueError as ve:
            print("❌ Token verification failed:", str(ve))
            logger.warning("Google token verification failed for client_id '%s': %s", client_id, ve)
            return jsonify({"error": f"Invalid token: {str(ve)}"}), 401

        # ── Extract verified claims ────────────────────────────────────────
        email     = (idinfo.get('email') or '').lower().strip()
        full_name = idinfo.get('name', '')
        picture   = idinfo.get('picture', '')
        google_sub = idinfo.get('sub', '')

        print("✅ Google user:", email)

        if not email:
            return jsonify({"error": "No email returned by Google"}), 400

        # ── Find or create company ─────────────────────────────────────────
        existing = db.companies.find_one({"email": email})
        if existing:
            # Update Google-specific fields on every login
            db.companies.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "profile_picture": picture,
                    "last_login_at":   datetime.utcnow(),
                }}
            )
            company      = db.companies.find_one({"_id": existing["_id"]})
            is_new       = False
        else:
            result = db.companies.insert_one({
                "email":           email,
                "password":        None,
                "company_name":    full_name or email.split("@")[0],
                "full_name":       full_name,
                "profile_picture": picture,
                "is_verified":     True,
                "has_password":    False,
                "auth_provider":   "google",
                "google_sub":      google_sub,
                "industry":        "Technology",
                "team_size":       "1-10",
                "created_at":      datetime.utcnow(),
                "last_login_at":   datetime.utcnow(),
            })
            company = db.companies.find_one({"_id": result.inserted_id})
            is_new  = True

        company_id   = str(company["_id"])
        company_name = company.get("company_name") or full_name or email.split("@")[0]
        has_password = bool(company.get("has_password") or company.get("password"))

        # ── Issue HireFlow JWT ─────────────────────────────────────────────
        access_token = generate_token(
            company_id=company_id,
            email=email,
            secret=Config.SECRET_KEY,
            expires_hours=Config.JWT_ACCESS_EXPIRES_HOURS,
        )

        # Also issue a refresh token so the session can be silently renewed
        refresh_token, refresh_expires = generate_refresh_token(
            company_id=company_id,
            email=email,
            refresh_secret=Config.JWT_REFRESH_SECRET,
            expires_days=Config.JWT_REFRESH_EXPIRES_DAYS,
        )
        db.refresh_tokens.insert_one({
            "company_id": company_id,
            "email":      email,
            "token":      refresh_token,
            "expires_at": refresh_expires,
            "created_at": datetime.utcnow(),
            "revoked":    False,
        })

        logger.info("Google login: %s (new=%s)", email, is_new)
        return jsonify({
            "token":         access_token,
            "refresh_token": refresh_token,
            "company_id":    company_id,
            "company_name":  company_name,
            "is_new_user":   is_new,
            "has_password":  has_password,
            "user": {
                "name":            full_name,
                "email":           email,
                "profile_picture": picture,
            },
        }), 200

    except Exception as e:
        logger.error("Google login error", exc_info=True)
        return jsonify({"error": "Google authentication failed"}), 500
