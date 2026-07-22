"""Agent 4: Email Sender - Write and send shortlist invitation emails."""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

EMAIL_GENERATOR_PROMPT = """You are an experienced recruiter writing a warm interview invitation email.

CANDIDATE NAME: {candidate_name}
JOB ROLE: {job_title}
COMPANY NAME: {company_name}
RECRUITER EMAIL: {recruiter_email}
{interview_link_info}

Write a friendly, professional email inviting {candidate_name} to an interview for the {job_title} role at {company_name}. The email should:
- Use their actual name warmly
- Reference the specific role and company
- Express genuine enthusiasm
- Be warm but professional (conversational tone, not robotic)
- End with recruiter email for follow-up
{interview_link_instruction}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "subject": "Interview Invitation - {job_title} at {company_name}",
  "body_html": "<p>...</p><p>...</p>..."
}}

Guidelines:
- Subject line should be clear and professional (e.g., "Interview Invitation - Senior Python Engineer at Acme Corp")
- Body should be 3-5 paragraphs
- Use HTML with <p> tags for paragraphs, not plain text
- Be genuine and conversational
- Mention something specific about why they're a good fit (but don't quote their resume)
- Keep tone warm but professional

Example opening: "Hi {candidate_name}, We were impressed by your background and would like to invite you to interview for the {job_title} position at {company_name}..."

Return ONLY the JSON object. No markdown. No explanation."""

REJECTION_EMAIL_PROMPT = """You are an experienced recruiter writing a polite and professional candidate rejection email for a screening stage.

CANDIDATE NAME: {candidate_name}
JOB ROLE: {job_title}
COMPANY NAME: {company_name}
RECRUITER EMAIL: {recruiter_email}

Write a polite, professional rejection email thanking {candidate_name} for applying for the {job_title} role at {company_name}. The email should:
- Use their actual name warmly
- Reference the specific role and company
- Express appreciation for their time and application
- State clearly but politely that we are moving forward with other candidates whose profiles more closely align with the current needs
- Keep an encouraging and supportive tone
- End with recruiter email or support contact
- Do NOT mention any numeric scores or specific gaps

Return ONLY valid JSON (no markdown, no explanation):
{{
  "subject": "Application Update - {job_title} at {company_name}",
  "body_html": "<p>...</p><p>...</p>..."
}}

Return ONLY the JSON object. No markdown. No explanation."""


class EmailSender(BaseAgent):
    """
    Agent 4: Email Sender
    
    Writes warm, personalized interview invitation emails.
    Note: This agent has TWO parts:
    1. Generate content (this class, using Gemini)
    2. Send email (separate function, using Resend API)
    
    Temperature is HIGH (0.7) because natural human-sounding writing benefits from variation.
    """
    
    def __init__(self, api_key: str):
        """Initialize with higher temperature for natural writing."""
        super().__init__(api_key, temperature=0.7)
        logger.info("EmailSender agent initialized")
    
    def generate_email(self, candidate_profile: dict, jd_data: dict, company_data: dict, interview_link: str = None) -> dict:
        """
        Generate email content for a shortlist invitation.
        
        Args:
            candidate_profile: Dict with keys:
                - name: candidate name
                - email: candidate email
            jd_data: Dict with keys:
                - job_title: string
            company_data: Dict with keys:
                - company_name: string
                - contact_email: string (recruiter email)
            interview_link: Optional interview URL to embed in the email
        
        Returns:
            {
                "success": True/False,
                "data": {
                    "subject": "...",
                    "body_html": "<p>...</p>..."
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Validation
        if not candidate_profile or not candidate_profile.get("name"):
            error = "Candidate profile missing name"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not jd_data:
            error = "Job data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not company_data:
            error = "Company data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        # Extract data
        candidate_name = candidate_profile.get("name", "Candidate")
        job_title = jd_data.get("job_title", "Unknown Role")
        company_name = company_data.get("company_name", "Our Company")
        recruiter_email = company_data.get("contact_email", "hiring@company.com")
        
        interview_link_info = f"INTERVIEW LINK: {interview_link}" if interview_link else ""
        interview_link_instruction = f"- Instruct them to click the following link to start their interactive spoken interview: {interview_link}" if interview_link else "- Invite them to reply to confirm availability\n- NOT reveal interview questions (we'll discuss in a follow-up)"

        # Call the LLM
        result = self.invoke(
            EMAIL_GENERATOR_PROMPT,
            variables={
                "candidate_name": candidate_name,
                "job_title": job_title,
                "company_name": company_name,
                "recruiter_email": recruiter_email,
                "interview_link_info": interview_link_info,
                "interview_link_instruction": interview_link_instruction,
                "interview_link": interview_link or ""
            },
            required_fields=["subject", "body_html"]
        )
        
        # Validation on parsed data
        if result["success"]:
            parsed = result["data"]
            
            # Ensure fields exist and are strings
            if "subject" not in parsed or not isinstance(parsed["subject"], str):
                parsed["subject"] = f"Interview Invitation - {job_title} at {company_name}"
            
            if "body_html" not in parsed or not isinstance(parsed["body_html"], str):
                parsed["body_html"] = f"<p>Hi {candidate_name},</p><p>We would like to invite you to interview for the {job_title} position.</p>"
            
            logger.info(f"Successfully generated email for {candidate_name}")
        
        return result

    def generate_rejection_email(self, candidate_profile: dict, jd_data: dict, company_data: dict) -> dict:
        """
        Generate email content for a screening rejection.
        
        Args:
            candidate_profile: Dict with keys:
                - name: candidate name
                - email: candidate email
            jd_data: Dict with keys:
                - job_title: string
            company_data: Dict with keys:
                - company_name: string
                - contact_email: string (recruiter email)
                
        Returns:
            {
                "success": True/False,
                "data": {
                    "subject": "...",
                    "body_html": "<p>...</p>..."
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Validation
        if not candidate_profile or not candidate_profile.get("name"):
            error = "Candidate profile missing name"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not jd_data:
            error = "Job data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not company_data:
            error = "Company data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        candidate_name = candidate_profile.get("name", "Candidate")
        job_title = jd_data.get("job_title", "Unknown Role")
        company_name = company_data.get("company_name", "Our Company")
        recruiter_email = company_data.get("contact_email", "hiring@company.com")
        
        # Call the LLM
        result = self.invoke(
            REJECTION_EMAIL_PROMPT,
            variables={
                "candidate_name": candidate_name,
                "job_title": job_title,
                "company_name": company_name,
                "recruiter_email": recruiter_email
            },
            required_fields=["subject", "body_html"]
        )
        
        # Validation on parsed data
        if result["success"]:
            parsed = result["data"]
            
            # Ensure fields exist and are strings
            if "subject" not in parsed or not isinstance(parsed["subject"], str):
                parsed["subject"] = f"Application Update - {job_title} at {company_name}"
            
            if "body_html" not in parsed or not isinstance(parsed["body_html"], str):
                parsed["body_html"] = f"<p>Hi {candidate_name},</p><p>Thank you for applying to the {job_title} position. Unfortunately, we cannot move forward with your application at this time.</p>"
            
            logger.info(f"Successfully generated rejection email for {candidate_name}")
        
        return result


def send_email_via_resend(recipient_email: str, subject: str, html_body: str, company_name: str, recruiter_email: str, resend_api_key: str) -> dict:
    """
    Send email using Resend API.
    
    Args:
        recipient_email: Candidate's email address
        subject: Email subject line
        html_body: Email body in HTML format
        company_name: Company name (for From field)
        recruiter_email: Recruiter's email address
        resend_api_key: Resend API key
    
    Returns:
        {
            "success": True/False,
            "message_id": "email_id_from_resend",
            "error": "error message if failed"
        }
    """
    try:
        import resend
        from config import Config
        
        sender_email = getattr(Config, "FROM_EMAIL", "onboarding@resend.dev")
        resend.api_key = resend_api_key
        
        # Send email
        params = {
            "from": f"{company_name} <{sender_email}>",
            "to": recipient_email,
            "subject": subject,
            "html": html_body,
            "reply_to": recruiter_email
        }
        
        response = resend.Emails.send(params)
        
        # Check if successful
        message_id = None
        if hasattr(response, 'id'):
            message_id = response.id
        elif isinstance(response, dict) and 'id' in response:
            message_id = response['id']
        elif hasattr(response, 'get') and response.get('id'):
            message_id = response.get('id')
            
        if message_id:
            logger.info(f"Email sent successfully to {recipient_email}. Message ID: {message_id}")
            return {
                "success": True,
                "message_id": message_id,
                "error": None
            }
        else:
            logger.error(f"Resend API returned unexpected response: {response}")
            return {
                "success": False,
                "message_id": None,
                "error": f"Unexpected Resend response: {response}"
            }
    
    except Exception as e:
        logger.error(f"Failed to send email via Resend: {str(e)}")
        return {
            "success": False,
            "message_id": None,
            "error": f"Email sending failed: {str(e)}"
        }


def get_static_rejection_email(candidate_name: str, job_title: str, company_name: str, recruiter_email: str) -> dict:
    """
    Generate respectful and polite static rejection email payload without LLM overhead.
    """
    subject = f"Application Update - {job_title} at {company_name}"
    body_html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.6;">
        <p>Dear {candidate_name},</p>
        <p>Thank you very much for your interest in the <strong>{job_title}</strong> position at <strong>{company_name}</strong> and for taking the time to submit your application.</p>
        <p>After careful review of your application, we regret to inform you that we will not be moving forward with your candidacy at this time. We received many applications from highly qualified candidates, and our decision was based on aligning qualifications with our current resource needs.</p>
        <p>We appreciate the time you took to apply and wish you the very best in your job search and future professional endeavors.</p>
        <p style="margin-top: 25px;">Best regards,</p>
        <p><strong>The Hiring Team</strong><br>{company_name}</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 25px 0;">
        <p style="font-size: 12px; color: #999999;">If you have any questions, you can reach out to us at {recruiter_email}.</p>
    </div>
    """
    return {
        "subject": subject,
        "body_html": body_html
    }
