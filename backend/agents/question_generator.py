"""Agent 3: Question Generator - Create personalized interview questions."""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

QUESTION_GENERATOR_PROMPT = """You are an expert interviewer preparing questions for a technical interview.

CANDIDATE NAME: {candidate_name}
THEIR STRENGTHS (skills they have): {matched_skills}
GAPS TO EXPLORE (skills they lack): {missing_skills}
ROLE: {job_title} ({seniority_level})
KEY CONCERNS FROM SCREENING: {concerns}

Generate 8 interview questions across three categories. Each question should be:
- Specific to THIS candidate (reference their skills/gaps by name)
- Appropriate to {seniority_level} level
- Designed to explore gaps while leveraging strengths

Return ONLY valid JSON (no markdown, no explanation):
{{
  "questions": [
    {{"category": "technical", "question": "...", "difficulty": "easy|medium|hard"}},
    {{"category": "behavioral", "question": "...", "difficulty": "easy|medium|hard"}},
    {{"category": "gap", "question": "...", "difficulty": "easy|medium|hard"}},
    ...
  ]
}}

Guidelines:
- **technical** (3 questions): Assess deep knowledge in their matched skills. Ask scenario questions.
- **behavioral** (3 questions): Assess teamwork, communication, leadership. For {seniority_level}, emphasize leadership/mentorship.
- **gap** (2 questions): Kindly explore their missing skills as learning opportunities. Frame positively.

Example gap question (if missing Docker): "Docker is new to you based on your resume. How would you approach learning containerization technology?"

IMPORTANT:
- Do NOT reveal the questions in any email or message to the candidate.
- Questions should feel natural and conversational, not robotic.
- Avoid generic questions like "What is your greatest strength?" - be specific.
- Reference their actual experience from their resume.

Return ONLY the JSON object. No markdown. No explanation."""


class QuestionGenerator(BaseAgent):
    """
    Agent 3: Question Generator
    
    Generates 8 personalized interview questions based on:
    - Candidate's matched skills (their strengths)
    - Candidate's missing skills (gaps to explore)
    - Role seniority level
    - Screening concerns
    
    Temperature is HIGH (0.7) because variation is good.
    Different candidates should get different questions, even with same gaps.
    """
    
    def __init__(self, api_key: str):
        """Initialize with higher temperature for creativity."""
        super().__init__(api_key, temperature=0.7)
        logger.info("QuestionGenerator agent initialized")
    
    def generate(self, candidate_profile: dict, jd_data: dict, screening_data: dict) -> dict:
        """
        Generate interview questions for a candidate.
        
        Args:
            candidate_profile: Dict with keys:
                - name: candidate name
            jd_data: Dict with keys:
                - job_title: string
                - seniority_level: string
            screening_data: Dict with keys:
                - matched_skills: list
                - missing_skills: list
                - concerns: list
        
        Returns:
            {
                "success": True/False,
                "data": {
                    "questions": [
                        {
                            "category": "technical|behavioral|gap",
                            "question": "...",
                            "difficulty": "easy|medium|hard"
                        },
                        ...
                    ]
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Validation
        if not candidate_profile:
            error = "Candidate profile is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not jd_data:
            error = "Job data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not screening_data:
            error = "Screening data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        # Extract data
        candidate_name = candidate_profile.get("name", "Candidate")
        job_title = jd_data.get("job_title", "Unknown Role")
        seniority_level = jd_data.get("seniority_level", "mid")
        
        matched_skills = screening_data.get("matched_skills", [])
        missing_skills = screening_data.get("missing_skills", [])
        concerns = screening_data.get("concerns", [])
        
        # Format for prompt
        matched_str = ", ".join(matched_skills) if matched_skills else "None identified"
        missing_str = ", ".join(missing_skills) if missing_skills else "None identified"
        concerns_str = " ".join(concerns) if concerns else "None identified"
        
        # Call the LLM
        result = self.invoke(
            QUESTION_GENERATOR_PROMPT,
            variables={
                "candidate_name": candidate_name,
                "matched_skills": matched_str,
                "missing_skills": missing_str,
                "job_title": job_title,
                "seniority_level": seniority_level,
                "concerns": concerns_str
            },
            required_fields=None
        )
        
        # Validation on parsed data
        if result["success"]:
            parsed = result["data"]
            
            # Handle if LLM returned a JSON array instead of wrapping object
            if isinstance(parsed, list):
                parsed = {"questions": parsed}
            elif not isinstance(parsed, dict):
                parsed = {"questions": []}
            
            # Ensure questions is a list
            questions = parsed.get("questions", [])
            if not isinstance(questions, list):
                questions = []
            
            # Validate each question has required fields
            for q in questions:
                if not isinstance(q, dict):
                    continue
                if "category" not in q:
                    q["category"] = "technical"
                if "question" not in q:
                    q["question"] = "Tell me about your experience."
                if "difficulty" not in q:
                    q["difficulty"] = "medium"
            
            parsed["questions"] = questions
            result["data"] = parsed
            logger.info(f"Successfully generated {len(questions)} questions for {candidate_name}")
        
        return result
