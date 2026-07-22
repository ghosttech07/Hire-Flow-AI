"""
backend/auth/auth_service.py
Auth service for handling registration, OTP verification, login, and resending OTPs.
"""

import bcrypt
import random
import logging
from datetime import datetime, timedelta
from config import Config
from services.jwt_utils import generate_token

logger = logging.getLogger(__name__)

def register_company(db, email, password, company_name, full_name) -> dict:
    """
    Registers a company:
    1. Raises ValueError if email already exists in `companies`.
    2. Generates a 6-digit OTP, stores it in `otps` with a 10 min expiry.
    3. Stores pending registration data in `temp_registrations` (password bcrypt-hashed).
    4. Sends the OTP via Resend.
    """
    # Check if company already exists
    existing = db.companies.find_one({"email": email})
    if existing:
        raise ValueError("Email already registered")
        
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Store OTP in db
    db.otps.update_one(
        {"email": email},
        {"$set": {"email": email, "otp": otp, "expires_at": expires_at}},
        upsert=True
    )
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Store temporary registration details
    db.temp_registrations.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "password": hashed_password,
                "company_name": company_name,
                "full_name": full_name,
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    # Send OTP
    subject = "Verify your HireFlow AI Account"
    html_body = f"""
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to HireFlow AI</h2>
        <p>Thank you for registering your company <strong>{company_name}</strong>.</p>
        <p>Please use the following 6-digit One-Time Password (OTP) to verify your account. This code is valid for 10 minutes:</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; border-radius: 4px;">
            {otp}
        </div>
        <p>If you did not request this, you can ignore this email.</p>
    </div>
    """
    
    logger.info(f"🔑 OTP generated for {email}: {otp}")
    
    if Config.RESEND_API_KEY:
        try:
            from agents.email_sender import send_email_via_resend
            send_email_via_resend(
                recipient_email=email,
                subject=subject,
                html_body=html_body,
                company_name=company_name,
                recruiter_email="hiring@hireflow.ai",
                resend_api_key=Config.RESEND_API_KEY
            )
        except Exception as e:
            logger.error(f"Failed to send OTP email via Resend: {e}")
    else:
        logger.warning("RESEND_API_KEY is not configured. OTP printed to console log.")
        
    return {"message": "OTP sent"}

def verify_otp_and_create_company(db, email, otp) -> dict:
    """
    Verifies OTP and creates the company:
    1. Looks up otp doc; raises ValueError if missing/expired/mismatched.
    2. Looks up temp_registrations doc; raises ValueError if missing.
    3. Inserts into `companies`: email, hashed password, company_name, full_name, is_verified=True, created_at.
    4. Deletes the otp doc and temp_registration doc.
    5. Issues a JWT and returns {"token": ..., "company_id": ..., "company_name": ...}.
    """
    # Look up OTP
    otp_doc = db.otps.find_one({"email": email})
    if not otp_doc:
        raise ValueError("Invalid or expired OTP")
        
    if otp_doc["otp"] != str(otp).strip():
        raise ValueError("Invalid OTP")
        
    if otp_doc["expires_at"] < datetime.utcnow():
        raise ValueError("OTP has expired")
        
    # Look up temporary registration
    temp_reg = db.temp_registrations.find_one({"email": email})
    if not temp_reg:
        raise ValueError("Registration data not found")
        
    # Check if company already registered
    existing = db.companies.find_one({"email": email})
    if existing:
        raise ValueError("Email already registered")
        
    # Insert company
    company_doc = {
        "email": temp_reg["email"],
        "password": temp_reg["password"],  # already hashed
        "company_name": temp_reg["company_name"],
        "full_name": temp_reg["full_name"],
        "is_verified": True,
        "created_at": datetime.utcnow()
    }
    result = db.companies.insert_one(company_doc)
    company_id = str(result.inserted_id)
    
    # Delete temporary documents
    db.otps.delete_one({"email": email})
    db.temp_registrations.delete_one({"email": email})
    
    # Issue JWT
    token = generate_token(company_id, email, Config.SECRET_KEY)
    
    return {
        "token": token,
        "company_id": company_id,
        "company_name": company_doc["company_name"]
    }

def login_company(db, email, password) -> dict:
    """
    Logins a company:
    1. Looks up company by email; raises ValueError("Invalid credentials") if not found OR bcrypt check fails.
    2. Issues a fresh JWT.
    3. Returns {"token": ..., "company_id": ..., "company_name": ...}.
    """
    company = db.companies.find_one({"email": email})
    if not company:
        raise ValueError("Invalid credentials")
        
    # Verify password
    if not bcrypt.checkpw(password.encode('utf-8'), company["password"].encode('utf-8')):
        raise ValueError("Invalid credentials")
        
    company_id = str(company["_id"])
    token = generate_token(company_id, email, Config.SECRET_KEY)
    
    return {
        "token": token,
        "company_id": company_id,
        "company_name": company.get("company_name", "")
    }

def resend_otp(db, email) -> dict:
    """
    Regenerates and resends OTP for a pending registration.
    """
    temp_reg = db.temp_registrations.find_one({"email": email})
    if not temp_reg:
        raise ValueError("No pending registration found for this email")
        
    # Generate new OTP
    otp = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Store OTP in db
    db.otps.update_one(
        {"email": email},
        {"$set": {"email": email, "otp": otp, "expires_at": expires_at}},
        upsert=True
    )
    
    # Send OTP
    company_name = temp_reg.get("company_name", "Our Company")
    subject = "Verify your HireFlow AI Account (Resend)"
    html_body = f"""
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to HireFlow AI</h2>
        <p>Thank you for registering your company <strong>{company_name}</strong>.</p>
        <p>Please use the following 6-digit One-Time Password (OTP) to verify your account. This code is valid for 10 minutes:</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; border-radius: 4px;">
            {otp}
        </div>
        <p>If you did not request this, you can ignore this email.</p>
    </div>
    """
    
    logger.info(f"🔄 Resent OTP generated for {email}: {otp}")
    
    if Config.RESEND_API_KEY:
        try:
            from agents.email_sender import send_email_via_resend
            send_email_via_resend(
                recipient_email=email,
                subject=subject,
                html_body=html_body,
                company_name=company_name,
                recruiter_email="hiring@hireflow.ai",
                resend_api_key=Config.RESEND_API_KEY
            )
        except Exception as e:
            logger.error(f"Failed to resend OTP email via Resend: {e}")
    else:
        logger.warning("RESEND_API_KEY is not configured. OTP printed to console log.")
        
    return {"message": "OTP sent"}
