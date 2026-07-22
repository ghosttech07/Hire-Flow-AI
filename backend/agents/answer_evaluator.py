"""Agent 5: Answer Evaluator - Score interview answers and make hiring recommendations."""

import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Prompts for different answer types (branching logic)

ANSWER_EVALUATOR_SPEECH_PROMPT = """You are an expert technical interviewer evaluating a candidate's spoken answer to an interview question.

QUESTION ASKED: {question}
CANDIDATE ANSWER (transcribed from speech): {answer}
CANDIDATE NAME: {candidate_name}
ROLE: {job_title} ({seniority_level})
EXPECTED COMPETENCIES: {expected_competencies}

Evaluate this answer on:
1. **Clarity**: How clearly did they explain their thinking?
2. **Technical Accuracy**: Is the technical content correct?
3. **Depth**: Did they go deep or stay surface-level?
4. **Completeness**: Did they address all aspects of the question?
5. **Communication**: How well did they communicate (for {seniority_level} level)?

For {seniority_level} level, expect high technical depth, clear communication, and strategic thinking.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "evaluation_score": <0-100>,
  "score_reasoning": "brief explanation of score",
  "competency_scores": {{
    "Clarity": <0-10>,
    "Technical Accuracy": <0-10>,
    "Depth": <0-10>,
    "Communication": <0-10>
  }},
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "final_recommendation": "reject|review|move_to_next_round|strong_hire"
}}

Scoring Guide (use this exactly):
- 90-100: Exceptional answer. Clear, accurate, deep, comprehensive. Strong hire.
- 75-89: Good answer. Solid technical knowledge, good communication, minor gaps. Move to next round.
- 60-74: Adequate answer. Correct but surface-level OR minor inaccuracies. Review (marginal).
- 40-59: Weak answer. Significant gaps, confusion, or incomplete. Likely reject.
- 0-39: Poor answer. Inaccurate, unclear, off-topic. Reject.

Recommendation guidance:
- 90+: "strong_hire" (exceptional, fast-track)
- 75-89: "move_to_next_round" (good, but need more evaluation)
- 60-74: "review" (marginal, decide based on other candidates)
- 40-59: "review" (weak, probably reject unless exceptional elsewhere)
- Below 40: "reject" (not qualified)

Return ONLY the JSON object. No markdown. No explanation."""


ANSWER_EVALUATOR_CODE_PROMPT = """You are a senior code reviewer evaluating a candidate's code submission for an interview.

QUESTION/PROMPT: {question}
CODE SUBMITTED:
{answer}

CANDIDATE NAME: {candidate_name}
ROLE: {job_title} ({seniority_level})
EXPECTED COMPETENCIES: {expected_competencies}

Evaluate this code on:
1. **Correctness**: Does it solve the problem correctly? Any logic errors?
2. **Efficiency**: Time/space complexity. Is it optimal or could be better?
3. **Code Quality**: Readability, style, naming conventions, comments.
4. **Edge Cases**: Did they handle edge cases? Null checks, boundary conditions?
5. **Problem-Solving Approach**: How did they approach the problem?

For {seniority_level} level, expect:
- Correct solutions with good efficiency
- Clean, production-ready code
- Consideration of edge cases
- Clear variable naming and structure

Return ONLY valid JSON (no markdown, no explanation):
{{
  "evaluation_score": <0-100>,
  "score_reasoning": "brief explanation of score",
  "competency_scores": {{
    "Correctness": <0-10>,
    "Efficiency": <0-10>,
    "Code Quality": <0-10>,
    "Problem-Solving": <0-10>
  }},
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "final_recommendation": "reject|review|move_to_next_round|strong_hire"
}}

Scoring Guide (use this exactly):
- 90-100: Perfect or near-perfect solution. Correct, efficient, clean code. Strong hire.
- 75-89: Good solution. Correct with minor inefficiencies OR minor code quality issues. Move to next round.
- 60-74: Adequate solution. Mostly correct but some inefficiencies OR missing edge cases. Review.
- 40-59: Weak solution. Has bugs OR significant inefficiencies OR poor code quality. Likely reject.
- 0-39: Non-working solution. Doesn't compile/run OR completely wrong approach. Reject.

Recommendation guidance:
- 90+: "strong_hire" (exceptional code)
- 75-89: "move_to_next_round" (good, but need more rounds)
- 60-74: "review" (marginal, depends on other interviews)
- 40-59: "review" (weak, probably reject)
- Below 40: "reject" (not qualified)

Return ONLY the JSON object. No markdown. No explanation."""


class AnswerEvaluator(BaseAgent):
    """
    Agent 5: Answer Evaluator
    
    Evaluates candidate interview answers (speech or code) and produces hiring recommendations.
    
    Key feature: Prompt branching
    - If answer_type == "speech": Use speech evaluation rubric
    - If answer_type == "code": Use code evaluation rubric
    - Both return same output shape (downstream agent doesn't need to know which type)
    
    Temperature is MODERATE-LOW (0.2) because evaluation must be fair and consistent.
    Same answer scored twice should produce similar scores.
    """
    
    def __init__(self, api_key: str):
        """Initialize with low-moderate temperature for consistency."""
        super().__init__(api_key, temperature=0.2)
        logger.info("AnswerEvaluator agent initialized")
    
    def evaluate(self, answer_data: dict, question_data: dict, jd_data: dict) -> dict:
        """
        Evaluate an interview answer (speech or code) and produce hiring recommendation.
        
        Args:
            answer_data: Dict with keys:
                - answer_type: "speech" or "code"
                - answer: string (transcribed text for speech, code for code)
                - candidate_name: string
            question_data: Dict with keys:
                - question: string (the question asked)
                - category: string (technical/behavioral/gap)
            jd_data: Dict with keys:
                - job_title: string
                - seniority_level: string
                - required_skills: list
        
        Returns:
            {
                "success": True/False,
                "data": {
                    "evaluation_score": 0-100,
                    "score_reasoning": "...",
                    "competency_scores": {...},
                    "strengths": [...],
                    "gaps": [...],
                    "final_recommendation": "reject|review|move_to_next_round|strong_hire"
                },
                "error": "error message if failed",
                "raw_response": "raw LLM response for debugging"
            }
        """
        # Validation
        if not answer_data:
            error = "Answer data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not question_data:
            error = "Question data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        if not jd_data:
            error = "Job data is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        # Extract data
        answer_type = answer_data.get("answer_type", "speech").lower()
        answer = answer_data.get("answer", "").strip()
        candidate_name = answer_data.get("candidate_name", "Candidate")
        
        if not answer:
            error = "Answer text is empty"
            logger.error(error)
            return {"success": False, "data": None, "error": error, "raw_response": ""}
        
        question = question_data.get("question", "Interview Question")
        job_title = jd_data.get("job_title", "Unknown Role")
        seniority_level = jd_data.get("seniority_level", "mid")
        expected_competencies = jd_data.get("required_skills", [])
        
        # Format competencies for prompt
        competencies_str = ", ".join(expected_competencies) if expected_competencies else "Technical skills"
        
        # SELECT PROMPT BASED ON ANSWER TYPE (branching logic)
        if answer_type == "code":
            prompt_template = ANSWER_EVALUATOR_CODE_PROMPT
            logger.info(f"Evaluating CODE answer for {candidate_name}")
        else:  # default to speech
            prompt_template = ANSWER_EVALUATOR_SPEECH_PROMPT
            logger.info(f"Evaluating SPEECH answer for {candidate_name}")
        
        # Call the LLM
        result = self.invoke(
            prompt_template,
            variables={
                "question": question,
                "answer": answer,
                "candidate_name": candidate_name,
                "job_title": job_title,
                "seniority_level": seniority_level,
                "expected_competencies": competencies_str
            },
            required_fields=["evaluation_score", "final_recommendation"]
        )
        
        # Additional validation on parsed data
        if result["success"]:
            parsed = result["data"]
            
            # Ensure evaluation_score is 0-100
            try:
                score = int(parsed.get("evaluation_score", 0))
                parsed["evaluation_score"] = max(0, min(100, score))
            except (ValueError, TypeError):
                parsed["evaluation_score"] = 0
            
            # Ensure competency_scores is dict with 0-10 values
            if not isinstance(parsed.get("competency_scores"), dict):
                parsed["competency_scores"] = {}
            
            for key in parsed["competency_scores"]:
                try:
                    score = int(parsed["competency_scores"][key])
                    parsed["competency_scores"][key] = max(0, min(10, score))
                except (ValueError, TypeError):
                    parsed["competency_scores"][key] = 5
            
            # Ensure lists
            if not isinstance(parsed.get("strengths"), list):
                parsed["strengths"] = []
            if not isinstance(parsed.get("gaps"), list):
                parsed["gaps"] = []
            
            # Ensure recommendation is valid
            valid_recs = ["reject", "review", "move_to_next_round", "strong_hire"]
            rec = parsed.get("final_recommendation", "review").lower()
            if rec not in valid_recs:
                parsed["final_recommendation"] = "review"
            else:
                parsed["final_recommendation"] = rec
            
            logger.info(f"Successfully evaluated answer: score={parsed['evaluation_score']}, recommendation={parsed['final_recommendation']}")
        
        return result
