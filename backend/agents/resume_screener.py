"""Agent 2: Resume Screener - Score candidate fit against job description."""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

RESUME_SCREENER_PROMPT = """You are an expert technical recruiter scoring candidates for job fit.

REQUIRED SKILLS FOR ROLE:
{required_skills}

JOB TITLE:
{job_title}

EXPERIENCE REQUIRED (years):
{experience_years}

CANDIDATE RESUME:
{resume_text}

Score this candidate's fit for the role. Return ONLY valid JSON:
{{
  "match_score": <0-100>,
  "score_reasoning": "...",
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3"],
  "concerns": ["concern1", "concern2"],
  "recommendation": "reject|review|shortlist"
}}

SCORING GUIDE (use this exactly):
- 90-100: Exceptional match. Has all required skills + strong experience level.
- 75-89: Strong match. Has most skills, maybe 1-2 gaps, right experience level.
- 60-74: Good match. Has core skills, 2-3 gaps, experience close to required.
- 40-59: Partial match. Missing key skills, would need training.
- 0-39: Weak match. Too many gaps, not recommended.

Recommendation guidance:
- 90+: "shortlist" (strong candidate, move forward)
- 75-89: "shortlist" (good candidate, move forward)
- 50-74: "shortlist" (meets minimum bar, move forward)
- Below 50: "reject" (too many gaps, not ready)

RULES:
- Check each required skill in the resume. Be precise.
- If resume mentions years of experience, extract it. Compare to required.
- Look for related skills (e.g., "Node.js" if "backend JavaScript" required).
- Concerns should be genuine gaps, not nitpicks.
- Return ONLY JSON. No markdown. No explanation."""


class ResumeScreener(BaseAgent):
    """
    Agent 2: Resume Screener
    
    Scores a candidate's resume against a job's requirements.
    Temperature is LOW (0.1) because scoring must be consistent.
    Same resume scored twice should produce similar scores.
    """
    
    def __init__(self, api_key: str):
        """Initialize with low temperature for consistency."""
        super().__init__(api_key, temperature=0.1)
        logger.info("ResumeScreener agent initialized")
    
    def screen(self, resume_text: str, jd_data: dict) -> dict:
        """
        Screen a candidate's resume against a job.
        
        Args:
            resume_text: Raw resume text (can be from PDF, Word, or plain text)
            jd_data: Job data dict with keys:
                - required_skills: list of skill strings
                - job_title: string
                - experience_years: number
        
        Returns:
            {
                "success": True/False,
                "data": {
                    "match_score": 0-100,
                    "score_reasoning": "...",
                    "matched_skills": [...],
                    "missing_skills": [...],
                    "concerns": [...],
                    "recommendation": "reject|review|shortlist"
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Validation
        if not resume_text or not resume_text.strip():
            error = "Resume text is empty"
            logger.error(error)
            return {
                "success": False,
                "data": None,
                "error": error,
                "raw_response": ""
            }
        
        if not jd_data:
            error = "Job data is empty"
            logger.error(error)
            return {
                "success": False,
                "data": None,
                "error": error,
                "raw_response": ""
            }
        
        # Extract required data from JD
        required_skills = jd_data.get("required_skills", [])
        job_title = jd_data.get("job_title", "Unknown Role")
        experience_years = jd_data.get("experience_years", 0)
        
        # Format skills for prompt
        if isinstance(required_skills, list):
            skills_str = ", ".join(required_skills)
        else:
            skills_str = str(required_skills)
        
        # Call the LLM via BaseAgent.invoke()
        result = self.invoke(
            RESUME_SCREENER_PROMPT,
            variables={
                "resume_text": resume_text,
                "required_skills": skills_str,
                "job_title": job_title,
                "experience_years": str(experience_years)
            },
            required_fields=["match_score", "matched_skills", "recommendation"]
        )
        
        # Additional validation on parsed data
        if result["success"]:
            parsed = result["data"]
            
            # Ensure match_score is 0-100
            try:
                score = int(parsed.get("match_score", 0))
                parsed["match_score"] = max(0, min(100, score))
            except (ValueError, TypeError):
                parsed["match_score"] = 0
            
            # Ensure matched_skills and missing_skills are lists
            if not isinstance(parsed.get("matched_skills"), list):
                parsed["matched_skills"] = []
            if not isinstance(parsed.get("missing_skills"), list):
                parsed["missing_skills"] = []
            
            # Ensure recommendation is valid
            valid_recs = ["reject", "review", "shortlist"]
            rec = parsed.get("recommendation", "review").lower()
            if rec not in valid_recs:
                parsed["recommendation"] = "review"
            else:
                parsed["recommendation"] = rec
            
            logger.info(f"Successfully screened resume: score={parsed['match_score']}, recommendation={parsed['recommendation']}")
        
        return result
