import logging
from flask import Blueprint, jsonify
from bson.objectid import ObjectId
from config import Config

logger = logging.getLogger(__name__)
result_bp = Blueprint('result', __name__, url_prefix='/api/result')
db = Config.db

@result_bp.route('/<token>', methods=['GET'])
def get_candidate_result(token):
    try:
        # 1. Look up candidate by token
        candidate = db.candidates.find_one({"interview_token": token})
        if not candidate:
            return jsonify({"success": False, "error": "Invalid result link"}), 404
            
        # 2. Check if completed
        completed_statuses = ["interview_completed", "offer_sent", "rejected_final"]
        if candidate.get("status") not in completed_statuses:
            return jsonify({"success": False, "error": "Your interview isn't finished yet"}), 425
            
        # 3. Retrieve target Job details
        job_id = candidate.get("job_id")
        job_title = "Unknown Role"
        if job_id:
            job = db.jobs.find_one({"_id": ObjectId(job_id)})
            if job:
                job_title = job.get("parsed", {}).get("job_title", "Unknown Role")
                
        # 4. Retrieve Company details
        company_id = candidate.get("company_id")
        company_name = "Our Company"
        if company_id:
            company = db.companies.find_one({"_id": ObjectId(company_id)})
            if company:
                company_name = company.get("company_name", "Our Company")
                
        # 5. Build question breakdown
        question_breakdown = []
        interview_questions = candidate.get("interview_questions", [])
        for hist in candidate.get("evaluation_history", []):
            eval_data = hist.get("evaluation", {})
            
            # Map category from interview_questions if not directly in history
            category = hist.get("category")
            if not category:
                question_id = hist.get("question_id")
                try:
                    if question_id is not None:
                        q_idx = int(question_id)
                        if 0 <= q_idx < len(interview_questions):
                            category = interview_questions[q_idx].get("category")
                except (ValueError, TypeError):
                    pass
            if not category:
                # Try matching by question text
                for q in interview_questions:
                    if q.get("question") == hist.get("question"):
                        category = q.get("category")
                        break
            if not category:
                category = "technical"

            question_breakdown.append({
                "question": hist.get("question", ""),
                "category": category,
                "evaluation_score": eval_data.get("evaluation_score", 0),
                "strengths": eval_data.get("strengths", []),
                "gaps": eval_data.get("gaps", []),
                "score_reasoning": eval_data.get("score_reasoning", "")
            })
            
        return jsonify({
            "candidate_name": candidate.get("candidate_name") or candidate.get("name") or "Candidate",
            "job_title": job_title,
            "company_name": company_name,
            "final_decision": {
                "outcome": candidate.get("final_decision", {}).get("outcome"),
                "final_score": candidate.get("final_decision", {}).get("final_score")
            },
            "question_breakdown": question_breakdown
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching candidate result for token {token}: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500
