"""
backend/agents/notification_writer.py
Agent for writing automated follow-up candidate emails based on scheduler outcomes.
"""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

NOTIFICATION_WRITER_PROMPT = """You are a professional hiring manager writing a follow-up email to a candidate after completing their interview session.

CANDIDATE NAME: {candidate_name}
JOB TITLE: {job_title}
COMPANY NAME: {company_name}
NEXT STEP: {next_step}
RESULT LINK: {result_link}

Write an appropriate email according to the selected NEXT STEP:
1. **offer**: Generate a warm, extremely enthusiastic congratulatory email. Let them know we want to extend a job offer and a member of our team will follow up shortly with the official paperwork and details.
   - IMPORTANT: This is a congratulatory notification, not a binding legal offer document. Do NOT invent or fabricate any compensation details, salary figures, start dates, or legal employment terms.
   - You MUST include their result page link ({result_link}) dynamically in the email body, letting them know they can click it to view their full interview performance report.
2. **final_reject**: Write a respectful, polite, and brief regret email. Thank them sincerely for their time and effort during the interview. Ensure the tone is warm but clear that we are not moving forward.
   - You MUST include their result page link ({result_link}) in the email body, letting them know they can click it to view their scores, feedback, and performance report.
3. **l2_technical** or **hr_round**: Write a warm, encouraging invitation to the next interview round (either a Level 2 Technical Interview or HR round). Explain what to expect and invite them to confirm availability.
4. **hr_review**: Write a warm email letting them know their profile is under final HR review and we will update them soon.
5. **hold**: Write an honest, polite update explaining that while we were impressed by their interview, we are currently pausing/holding their application while we complete evaluations of other candidates. Keep it warm but don't over-promise a specific date.
6. **reject**: Write a respectful, brief rejection email thanking them for their time.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "subject": "...",
  "body_html": "<p>...</p><p>...</p>"
}}

Guidelines:
- Subject line should be professional and personalized (e.g., "Next steps for {job_title} at {company_name}")
- Body must be formatted with HTML tags (<p>, <strong>, <a>, etc.)
- Use their actual name warm-heartedly
- Return ONLY the JSON object. No markdown, no preambles, no trailing text."""

class NotificationWriter(BaseAgent):
    def __init__(self, api_key: str):
        super().__init__(api_key, temperature=0.6)
        logger.info("NotificationWriter agent initialized")

    def write_notification(self, next_step: str, candidate_name: str, job_title: str, company_name: str, result_link: str = "") -> dict:
        """
        Generates notification email subject and html body based on next_step.
        """
        result = self.invoke(
            NOTIFICATION_WRITER_PROMPT,
            variables={
                "next_step": next_step,
                "candidate_name": candidate_name,
                "job_title": job_title,
                "company_name": company_name,
                "result_link": result_link
            },
            required_fields=["subject", "body_html"]
        )
        return result
