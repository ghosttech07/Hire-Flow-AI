"""Agent 1: JD Parser - Convert job description text into structured JSON."""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Strict Job Parser Prompt template as requested
JD_PARSER_PROMPT = """You are a strict job description parser used in a professional AI recruitment platform.

Your task is to extract structured job information ONLY from the provided input.

INPUT:
{job_description}

CRITICAL RULES:

1. Do NOT hallucinate or invent any information.
2. Do NOT assume job roles, technologies, or experience.
3. ONLY extract what is explicitly mentioned in the input.
4. If the input is too short, vague, or unclear, return an error.
5. NEVER generate default roles like "Python Developer", "Software Engineer", etc.
6. If any field is missing, return it as empty ("", []) — do not guess.
7. Output MUST be valid JSON only. No extra text.

INVALID INPUT HANDLING:

If the input is less than 50 characters OR not a proper job description, return EXACTLY:

{{
  "error": "Insufficient job description. Please provide a detailed job description including role, skills, and responsibilities."
}}

OUTPUT FORMAT:

{{
  "job_title": "",
  "skills": [],
  "experience_level": "",
  "responsibilities": []
}}

EXTRACTION RULES:

Job Title:
- Extract ONLY if clearly mentioned.
- Do NOT infer from skills.
- If unclear, return "".

Skills:
- Extract ONLY explicitly mentioned technologies/tools.
- Return as array of strings.

Experience Level:
- Extract ONLY if explicitly stated (junior, mid, senior, lead).
- Otherwise return "".

Responsibilities:
- Extract explicit responsibilities or tasks.
- If none present, return [].

EXAMPLE:

Input:
We are looking for a Senior React Developer with experience in React, Node.js, and REST APIs. The candidate will build scalable frontend systems and collaborate with backend teams.

Output:
{{
  "job_title": "Senior React Developer",
  "skills": ["React", "Node.js", "REST APIs"],
  "experience_level": "senior",
  "responsibilities": [
    "Build scalable frontend systems",
    "Collaborate with backend teams"
  ]
}}
"""


class JDParser(BaseAgent):
    """
    Agent 1: JD Parser
    
    Converts raw job description text into structured JSON strictly.
    Temperature is LOW (0.1) because we want consistent, deterministic output.
    """
    
    def __init__(self, api_key: str):
        """Initialize with low temperature for consistency."""
        super().__init__(api_key, temperature=0.1)
        logger.info("JDParser agent initialized")
    
    def parse(self, jd_text: str) -> dict:
        """
        Parse a job description into structured JSON strictly.
        
        Args:
            jd_text: Raw job description text
        
        Returns:
            {
                "success": True/False,
                "data": {
                    "job_title": "...",
                    "skills": [...],
                    "experience_level": "...",
                    "responsibilities": [...]
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Client side length validation before calling LLM
        clean_text = jd_text.strip() if jd_text else ""
        if len(clean_text) < 50:
            error_msg = "Insufficient job description. Please provide a detailed job description including role, skills, and responsibilities."
            logger.error(f"Length check failed: {len(clean_text)} chars")
            return {
                "success": False,
                "data": {
                    "error": error_msg
                },
                "error": error_msg,
                "raw_response": ""
            }
        
        if len(clean_text) > 10000:
            logger.warning(f"JD text is very long ({len(clean_text)} chars). Trimming to first 10000.")
            clean_text = clean_text[:10000]
        
        # Call the LLM via BaseAgent.invoke() without enforcing required_fields to allow error output
        result = self.invoke(
            JD_PARSER_PROMPT,
            variables={"job_description": clean_text},
            required_fields=[]
        )
        
        if result["success"]:
            parsed = result["data"]
            
            # Handle LLM error output
            if "error" in parsed:
                return {
                    "success": False,
                    "data": parsed,
                    "error": parsed["error"],
                    "raw_response": result.get("raw_response", "")
                }
            
            # Map experience level back to years for compatibility
            exp_lvl = str(parsed.get("experience_level", "")).lower()
            seniority = "mid"
            exp_years = 3
            if "senior" in exp_lvl:
                seniority = "senior"
                exp_years = 5
            elif "junior" in exp_lvl:
                seniority = "junior"
                exp_years = 1
            elif "lead" in exp_lvl or "executive" in exp_lvl:
                seniority = "executive"
                exp_years = 10
            
            # Set internal backward compatibility mappings
            parsed["required_skills"] = parsed.get("skills", [])
            parsed["seniority_level"] = seniority
            parsed["experience_years"] = exp_years
            parsed["education_required"] = ""
            
            logger.info(f"Successfully parsed JD: {parsed.get('job_title')}")
        
        return result
