"""Flask blueprint for token-gated public candidate interview session endpoints."""

import logging
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from config import Config

logger = logging.getLogger(__name__)

interview_bp = Blueprint('interview', __name__, url_prefix='/api/interview')
db = Config.db


def trigger_decision_logic(candidate, job, db):
    """
    Synchronously run next-step score aggregation, compute final score,
    evaluate outcome against threshold, write to DB, and send offer/regret outreach.
    """
    try:
        from agents.decision_engine import compute_final_score, decide_outcome
        from agents.notification_writer import NotificationWriter
        from agents.email_sender import send_email_via_resend
        
        # 1. Compute final score and decide outcome
        eval_history = candidate.get("evaluation_history", [])
        final_score = compute_final_score(eval_history)
        outcome = decide_outcome(final_score, Config.HIRE_THRESHOLD)
        
        status = "offer_sent" if outcome == "offer" else "rejected_final"
        next_step = "offer" if outcome == "offer" else "final_reject"
        
        # 2. Store final decision and status update
        final_decision = {
            "outcome": outcome,
            "final_score": final_score,
            "threshold_used": Config.HIRE_THRESHOLD,
            "decided_at": datetime.utcnow().isoformat()
        }
        
        # In R4, result_token is interview_token
        result_token = candidate.get("interview_token")
        
        # Look up company name & recruiter details
        company_id = candidate.get("company_id")
        comp_name = "Our Company"
        recruiter_email = "hiring@company.com"
        
        if company_id:
            try:
                comp = db.companies.find_one({"_id": ObjectId(company_id)})
                if comp:
                    comp_name = comp.get("company_name", "Our Company")
                    recruiter_email = comp.get("email", "hiring@company.com")
            except Exception as e:
                logger.warning(f"Failed to lookup company metadata: {e}")
                
        # 3. Create the result link
        result_link = f"{Config.FRONTEND_URL}/result/{result_token}"
        
        # 4. Generate candidate email via NotificationWriter
        writer = NotificationWriter(Config.GEMINI_API_KEY)
        write_result = writer.write_notification(
            next_step=next_step,
            candidate_name=candidate.get("candidate_name") or candidate.get("name") or "Candidate",
            job_title=job.get("parsed", {}).get("job_title", "Position"),
            company_name=comp_name,
            result_link=result_link
        )
        
        email_sent = False
        email_error = None
        email_message_id = None
        
        if write_result["success"]:
            email_content = write_result["data"]
            body_html = email_content.get("body_html", "")
            
            # Fail-safe injection to verify result link presence in LLM response
            if result_link not in body_html:
                if next_step == "offer":
                    body_html += f'<p>You can view your detailed feedback and performance report here: <a href="{result_link}">{result_link}</a></p>'
                else:
                    body_html += f'<p>You can view your interview evaluation report here: <a href="{result_link}">{result_link}</a></p>'
            
            # Send outreach email via Resend sandbox
            send_res = send_email_via_resend(
                recipient_email=candidate.get("candidate_email") or candidate.get("email") or "",
                subject=email_content.get("subject", "Application Update"),
                html_body=body_html,
                company_name=comp_name,
                recruiter_email=recruiter_email,
                resend_api_key=Config.RESEND_API_KEY
            )
            email_sent = send_res["success"]
            email_error = send_res.get("error")
            email_message_id = send_res.get("message_id")
        else:
            email_error = f"Failed to generate outreach email: {write_result.get('error')}"
            
        # 5. Save scheduling/decision results and lock token
        scheduling_info = {
            "next_step": next_step,
            "scheduled_date": datetime.utcnow().isoformat(),
            "notified_at": datetime.utcnow() if email_sent else None,
            "email_sent": email_sent,
            "email_error": email_error,
            "email_message_id": email_message_id
        }
        
        db.candidates.update_one(
            {"_id": candidate["_id"]},
            {
                "$set": {
                    "status": status,
                    "interview_token_used": True,
                    "result_token": result_token,
                    "final_decision": final_decision,
                    "scheduling": scheduling_info,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        logger.info(f"Successfully executed final decision engine for candidate {candidate['_id']}. Outcome: {outcome}, Score: {final_score}")
        
    except Exception as e:
        logger.error(f"Error executing final decision logic for candidate {candidate.get('_id')}: {str(e)}", exc_info=True)


@interview_bp.route('/<token>', methods=['GET'])
def get_interview_session(token):
    """
    GET /api/interview/<token>
    Look up candidate details and questions list using their unique token.
    Publicly accessible.
    """
    try:
        # 1. Look up candidate by token
        candidate = db.candidates.find_one({"interview_token": token})
        if not candidate:
            return jsonify({"success": False, "error": "Invalid interview link"}), 404
            
        # 2. Check token expiration
        expires_at = candidate.get("interview_token_expires_at")
        if expires_at and datetime.utcnow() > expires_at:
            return jsonify({"success": False, "error": "This interview link has expired"}), 410
            
        # 3. Check completion states
        completed_statuses = ["interview_completed", "offer_sent", "rejected_final"]
        if candidate.get("interview_token_used") or candidate.get("status") in completed_statuses:
            return jsonify({"success": False, "error": "This interview has already been completed"}), 410
            
        # 4. Flip status to interview_in_progress on first valid load
        if candidate.get("status") == "interview_invited":
            db.candidates.update_one(
                {"_id": candidate["_id"]},
                {"$set": {"status": "interview_in_progress", "updated_at": datetime.utcnow()}}
            )
            candidate["status"] = "interview_in_progress"
            
        # 5. Fetch associated job and company descriptions
        job_id = candidate.get("job_id")
        job = db.jobs.find_one({"_id": ObjectId(job_id)})
        job_title = job.get("parsed", {}).get("job_title", "Unknown Role") if job else "Unknown Role"
        
        company_id = candidate.get("company_id")
        company = db.companies.find_one({"_id": ObjectId(company_id)})
        company_name = company.get("company_name", "Our Company") if company else "Our Company"
        
        # 6. Map question array to include unique string identifiers
        questions = []
        for i, q in enumerate(candidate.get("interview_questions", [])):
            questions.append({
                "id": str(i),
                "category": q.get("category", "technical"),
                "question": q.get("question", ""),
                "difficulty": q.get("difficulty", "medium")
            })
            
        # 7. Compute resumable index dynamically using evaluation history
        current_question_index = len(candidate.get("evaluation_history", []))
        
        return jsonify({
            "candidate_name": candidate.get("name") or candidate.get("candidate_name") or "Candidate",
            "job_title": job_title,
            "company_name": company_name,
            "questions": questions,
            "current_question_index": current_question_index
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching interview session for token {token}: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@interview_bp.route('/<token>/answer', methods=['POST'])
def submit_answer(token):
    """
    POST /api/interview/<token>/answer
    Submit candidate answer to a single question for evaluation.
    Publicly accessible.
    """
    try:
        # 1. Look up candidate and run session validation guards
        candidate = db.candidates.find_one({"interview_token": token})
        if not candidate:
            return jsonify({"success": False, "error": "Invalid interview link"}), 404
            
        expires_at = candidate.get("interview_token_expires_at")
        if expires_at and datetime.utcnow() > expires_at:
            return jsonify({"success": False, "error": "This interview link has expired"}), 410
            
        completed_statuses = ["interview_completed", "offer_sent", "rejected_final"]
        if candidate.get("interview_token_used") or candidate.get("status") in completed_statuses:
            return jsonify({"success": False, "error": "This interview has already been completed"}), 410
            
        # 2. Extract and validate parameters
        data = request.get_json() or {}
        question_id = data.get("question_id")
        answer_type = data.get("answer_type", "speech").lower()
        answer = data.get("answer", "").strip()
        
        if question_id is None or not answer:
            return jsonify({"success": False, "error": "question_id and answer are required"}), 400
            
        if answer_type not in ["speech", "code"]:
            return jsonify({"success": False, "error": "answer_type must be 'speech' or 'code'"}), 400
            
        # 3. Retrieve target question from stored checklist
        questions = candidate.get("interview_questions", [])
        try:
            q_idx = int(question_id)
        except ValueError:
            return jsonify({"success": False, "error": "Invalid question_id format"}), 400
            
        if q_idx < 0 or q_idx >= len(questions):
            return jsonify({"success": False, "error": "Question not found"}), 400
            
        target_question = questions[q_idx]
        question_text = target_question.get("question")
        
        # 4. Guard against duplicate submissions
        already_answered = False
        for hist in candidate.get("evaluation_history", []):
            if hist.get("question_id") == str(question_id) or hist.get("question") == question_text:
                already_answered = True
                break
                
        if already_answered:
            return jsonify({"success": False, "error": "This question has already been answered"}), 400
            
        # 5. Retrieve associated Job details
        job_id = candidate.get("job_id")
        job = db.jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            return jsonify({"success": False, "error": "Associated job description not found"}), 404
            
        # 6. Call Agent 5: AnswerEvaluator
        from agents.answer_evaluator import AnswerEvaluator
        evaluator = AnswerEvaluator(Config.GEMINI_API_KEY)
        evaluation_result = evaluator.evaluate(
            answer_data={
                "answer_type": answer_type,
                "answer": answer,
                "candidate_name": candidate.get("name") or candidate.get("candidate_name") or "Candidate"
            },
            question_data={
                "question": question_text,
                "category": target_question.get("category", "technical")
            },
            jd_data=job.get("parsed", {})
        )
        
        if not evaluation_result["success"]:
            logger.error(f"Answer evaluation failed: {evaluation_result['error']}")
            return jsonify({"success": False, "error": f"Evaluation failed: {evaluation_result['error']}"}), 500
            
        evaluation = evaluation_result["data"]
        
        # 7. Append result to evaluation_history and update latest_evaluation details
        db.candidates.update_one(
            {"_id": candidate["_id"]},
            {
                "$set": {
                    "latest_evaluation": evaluation,
                    "evaluation_type": answer_type,
                    "evaluation_timestamp": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                "$push": {
                    "evaluation_history": {
                        "timestamp": datetime.utcnow(),
                        "answer_type": answer_type,
                        "evaluation": evaluation,
                        "question": question_text,
                        "question_id": str(question_id)
                    }
                }
            }
        )
        
        # Calculate updated completion properties
        history_len = len(candidate.get("evaluation_history", [])) + 1
        total_questions = len(questions)
        is_last_question = (history_len >= total_questions)
        
        if is_last_question:
            # Fetch latest document snapshot for decision dispatches
            updated_candidate = db.candidates.find_one({"_id": candidate["_id"]})
            trigger_decision_logic(updated_candidate, job, db)
            
        # Determine next question checklist item
        next_question = None
        if not is_last_question and history_len < total_questions:
            next_q = questions[history_len]
            next_question = {
                "id": str(history_len),
                "category": next_q.get("category", "technical"),
                "question": next_q.get("question", ""),
                "difficulty": next_q.get("difficulty", "medium")
            }
            
        return jsonify({
            "evaluation_score": evaluation.get("evaluation_score", 0),
            "is_last_question": is_last_question,
            "next_question": next_question
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing answer submission: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500
