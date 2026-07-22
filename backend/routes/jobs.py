"""Flask blueprint for job-related API endpoints."""

import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from config import Config
from agents.jd_parser import JDParser
from utils.resume_extractor import extract_text_from_file, extract_photo_from_pdf, extract_name_from_resume_text
from middleware.auth import require_auth
import tempfile
import os

logger = logging.getLogger(__name__)

jobs_bp = Blueprint('jobs', __name__, url_prefix='/api/jobs')
db = Config.db
jd_parser = JDParser(Config.GEMINI_API_KEY)


@jobs_bp.route('/parse', methods=['POST'])
@require_auth
def parse_job():
    """
    POST /api/jobs/parse
    Parse a job description without saving to the database.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Request body is empty"}), 400
        
        jd_text = data.get('jd_text', '').strip()
        if not jd_text:
            return jsonify({"success": False, "error": "jd_text is required"}), 400
            
        logger.info("Parsing JD only...")
        parse_result = jd_parser.parse(jd_text)
        if not parse_result["success"]:
            return jsonify({
                "success": False,
                "error": parse_result["error"]
            }), 400
        return jsonify({
            "success": True,
            "parsed": parse_result["data"]
        }), 200
    except Exception as e:
        logger.error(f"Error parsing JD: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@jobs_bp.route('/', methods=['POST'])
@require_auth
def create_job():
    """
    POST /api/jobs/
    Create a new job and parse the job description.
    
    Request: {"jd_text": "...", "parsed": {...}}
    Response: {"success": true/false, "job_id": "...", "parsed": {...}, "error": "..."}
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Request body is empty"}), 400
        
        jd_text = data.get('jd_text', '').strip()
        company_id = request.company_id
        
        if not jd_text:
            return jsonify({"success": False, "error": "jd_text is required"}), 400
        
        parsed_data = data.get('parsed')
        if not parsed_data:
            logger.info(f"Parsing JD for company {company_id}")
            parse_result = jd_parser.parse(jd_text)
            
            if not parse_result["success"]:
                logger.error(f"JD parsing failed: {parse_result['error']}")
                return jsonify({
                    "success": False,
                    "error": parse_result["error"],
                    "raw_response": parse_result.get("raw_response", "")[:500]
                }), 400
            parsed_data = parse_result["data"]
        
        job_doc = {
            "company_id": company_id,
            "jd_text": jd_text,
            "parsed": parsed_data,
            "created_at": datetime.utcnow(),
            "status": "active"
        }
        
        result = db.jobs.insert_one(job_doc)
        job_id = str(result.inserted_id)
        
        logger.info(f"Job created: {job_id}")
        
        return jsonify({
            "success": True,
            "job_id": job_id,
            "parsed": parsed_data
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating job: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/file/', methods=['POST'])
@require_auth
def upload_job_file():
    """
    POST /api/jobs/file/
    Upload a PDF or Word file with job description.
    
    Form data: file
    Response: {"success": true/false, "job_id": "...", "parsed": {...}, "error": "..."}
    """
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"success": False, "error": "File name is empty"}), 400
        
        company_id = request.company_id
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp_path = tmp.name
            file.save(tmp_path)
        
        try:
            logger.info(f"Extracting text from uploaded file: {file.filename}")
            jd_text = extract_text_from_file(tmp_path)
            
            parse_result = jd_parser.parse(jd_text)
            
            if not parse_result["success"]:
                return jsonify({"success": False, "error": parse_result["error"]}), 400
            
            job_doc = {
                "company_id": company_id,
                "jd_text": jd_text,
                "parsed": parse_result["data"],
                "file_name": file.filename,
                "created_at": datetime.utcnow(),
                "status": "active"
            }
            
            result = db.jobs.insert_one(job_doc)
            job_id = str(result.inserted_id)
            
            logger.info(f"Job created from file: {job_id}")
            
            return jsonify({
                "success": True,
                "job_id": job_id,
                "parsed": parse_result["data"],
                "file_name": file.filename
            }), 201
        
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        logger.error(f"Error uploading job file: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"File upload failed: {str(e)}"}), 500


@jobs_bp.route('/', methods=['GET'])
@require_auth
def list_jobs():
    """
    GET /api/jobs/
    List all jobs for a company.
    
    Response: {"success": true, "jobs": [{job_id, job_title, status, created_at}, ...]}
    """
    try:
        company_id = request.company_id
        
        jobs = db.jobs.find(
            {"company_id": company_id},
            {"jd_text": 0}
        ).sort("created_at", -1)
        
        jobs_list = []
        for job in jobs:
            job_id_str = str(job["_id"])
            # Gather pipeline funnel counts
            applied_cnt = db.candidates.count_documents({"job_id": job_id_str, "company_id": company_id})
            invited_cnt = db.candidates.count_documents({
                "job_id": job_id_str, 
                "company_id": company_id,
                "status": {"$in": ["interview_invited", "interview_in_progress", "interview_completed", "offer_sent", "rejected_final"]}
            })
            offers_cnt = db.candidates.count_documents({
                "job_id": job_id_str,
                "company_id": company_id,
                "status": "offer_sent"
            })
            
            jobs_list.append({
                "job_id": job_id_str,
                "job_title": job.get("parsed", {}).get("job_title", "Untitled"),
                "status": job.get("status", "active"),
                "created_at": job.get("created_at").isoformat() if job.get("created_at") else None,
                "funnel": {
                    "applied": applied_cnt,
                    "invited": invited_cnt,
                    "offers": offers_cnt
                }
            })
        
        return jsonify({"success": True, "jobs": jobs_list}), 200
    
    except Exception as e:
        logger.error(f"Error listing jobs: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>', methods=['GET'])
@require_auth
def get_job(job_id):
    """
    GET /api/jobs/<job_id>
    Get full job details.
    
    Response: {"success": true, "job": {job_id, job_title, jd_text, parsed, created_at}}
    """
    try:
        try:
            oid = ObjectId(job_id)
        except:
            return jsonify({"success": False, "error": "Invalid job ID format"}), 400
        
        company_id = request.company_id
        
        job = db.jobs.find_one({
            "_id": oid,
            "company_id": company_id
        })
        
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        return jsonify({
            "success": True,
            "job": {
                "job_id": str(job["_id"]),
                "job_title": job.get("parsed", {}).get("job_title"),
                "jd_text": job.get("jd_text", ""),
                "parsed": job.get("parsed", {}),
                "created_at": job.get("created_at").isoformat() if job.get("created_at") else None
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting job: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/status', methods=['PATCH'])
@require_auth
def update_job_status(job_id):
    """
    PATCH /api/jobs/<job_id>/status
    Pause or resume a job posting.
    Request: {"status": "active" | "paused"}
    """
    try:
        try:
            oid = ObjectId(job_id)
        except Exception:
            return jsonify({"success": False, "error": "Invalid job ID"}), 400

        data = request.get_json() or {}
        new_status = data.get("status", "").lower()

        if new_status not in ("active", "paused"):
            return jsonify({"success": False, "error": "Status must be 'active' or 'paused'"}), 400

        company_id = request.company_id
        result = db.jobs.update_one(
            {"_id": oid, "company_id": company_id},
            {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Job not found"}), 404

        logger.info(f"Job {job_id} status updated to {new_status}")
        return jsonify({"success": True, "status": new_status}), 200

    except Exception as e:
        logger.error(f"Error updating job status: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@jobs_bp.route('/<job_id>', methods=['DELETE'])
@require_auth
def delete_job(job_id):
    """
    DELETE /api/jobs/<job_id>
    Permanently delete a job and all its candidates.
    """
    try:
        try:
            oid = ObjectId(job_id)
        except Exception:
            return jsonify({"success": False, "error": "Invalid job ID"}), 400

        company_id = request.company_id

        job = db.jobs.find_one({"_id": oid, "company_id": company_id})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404

        # Delete all candidates for this job first
        deleted_candidates = db.candidates.delete_many({"job_id": job_id, "company_id": company_id})
        db.jobs.delete_one({"_id": oid})

        logger.info(f"Job {job_id} deleted along with {deleted_candidates.deleted_count} candidates")
        return jsonify({"success": True, "deleted_candidates": deleted_candidates.deleted_count}), 200

    except Exception as e:
        logger.error(f"Error deleting job: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@jobs_bp.route('/<job_id>/candidates/screen', methods=['POST'])
@require_auth
def screen_candidate(job_id):
    """
    POST /api/jobs/<job_id>/candidates/screen
    Screen a resume against a job.
    
    Request: {"resume_text": "..."}
    Response: {"success": true/false, "candidate_id": "...", "screening": {...}, "error": "..."}
    """
    try:
        from agents.resume_screener import ResumeScreener
        
        # Get the job first
        try:
            oid = ObjectId(job_id)
        except:
            return jsonify({"success": False, "error": "Invalid job ID format"}), 400
        
        company_id = request.company_id
        
        job = db.jobs.find_one({
            "_id": oid,
            "company_id": company_id
        })
        
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Request body is empty"}), 400
        
        resume_text = data.get('resume_text', '').strip()
        candidate_name = data.get('candidate_name', 'Anonymous')
        candidate_email = data.get('candidate_email', '')
        
        if not resume_text:
            return jsonify({"success": False, "error": "resume_text is required"}), 400
        
        # Initialize Agent 2
        screener = ResumeScreener(Config.GEMINI_API_KEY)
        
        # Screen the resume
        logger.info(f"Screening resume against job {job_id}")
        screening_result = screener.screen(resume_text, job['parsed'])
        
        if not screening_result["success"]:
            logger.error(f"Resume screening failed: {screening_result['error']}")
            return jsonify({
                "success": False,
                "error": screening_result["error"],
                "raw_response": screening_result["raw_response"][:500]
            }), 400
        
        # Save candidate to MongoDB
        candidate_doc = {
            "company_id": company_id,
            "job_id": job_id,
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "resume_text": resume_text,
            "screening": screening_result["data"],
            "status": screening_result["data"]["recommendation"],
            "created_at": datetime.utcnow()
        }
        
        result = db.candidates.insert_one(candidate_doc)
        candidate_id = str(result.inserted_id)
        
        logger.info(f"Candidate screened: {candidate_id}, score: {screening_result['data']['match_score']}")
        
        return jsonify({
            "success": True,
            "candidate_id": candidate_id,
            "screening": screening_result["data"]
        }), 201
    
    except Exception as e:
        logger.error(f"Error screening candidate: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates/screen/file', methods=['POST'])
@require_auth
def screen_candidate_file(job_id):
    """
    POST /api/jobs/<job_id>/candidates/screen/file
    Upload a resume file (PDF, DOCX, TXT) and screen it against the job.
    
    Form data: file, candidate_name (optional), candidate_email (optional)
    Response: {"success": true/false, "candidate_id": "...", "screening": {...}, "error": "..."}
    """
    try:
        from agents.resume_screener import ResumeScreener
        
        # Get the job first
        try:
            oid = ObjectId(job_id)
        except:
            return jsonify({"success": False, "error": "Invalid job ID format"}), 400
        
        company_id = request.company_id
        
        job = db.jobs.find_one({
            "_id": oid,
            "company_id": company_id
        })
        
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"success": False, "error": "File name is empty"}), 400
        
        candidate_name = request.form.get('candidate_name', 'Anonymous')
        candidate_email = request.form.get('candidate_email', '')
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp_path = tmp.name
            file.save(tmp_path)
            
        try:
            logger.info(f"Extracting text from uploaded resume: {file.filename}")
            resume_text = extract_text_from_file(tmp_path)
            
            # Initialize Agent 2
            screener = ResumeScreener(Config.GEMINI_API_KEY)
            
            # Screen the resume
            logger.info(f"Screening resume from file against job {job_id}")
            screening_result = screener.screen(resume_text, job['parsed'])
            
            if not screening_result["success"]:
                logger.error(f"Resume screening failed: {screening_result['error']}")
                return jsonify({
                    "success": False,
                    "error": screening_result["error"],
                    "raw_response": screening_result["raw_response"][:500]
                }), 400
            
            # Extract real name from resume & photo if PDF
            resume_name = extract_name_from_resume_text(resume_text, fallback=candidate_name)
            photo_base64 = None
            if file.filename.lower().endswith('.pdf'):
                with open(tmp_path, 'rb') as pf:
                    photo_base64 = extract_photo_from_pdf(pf)

            # Save candidate to MongoDB
            candidate_doc = {
                "company_id": company_id,
                "job_id": job_id,
                "candidate_name": candidate_name,
                "resume_name": resume_name,
                "candidate_email": candidate_email,
                "resume_text": resume_text,
                "photo_base64": photo_base64,
                "screening": screening_result["data"],
                "status": screening_result["data"]["recommendation"],
                "file_name": file.filename,
                "created_at": datetime.utcnow()
            }
            
            result = db.candidates.insert_one(candidate_doc)
            candidate_id = str(result.inserted_id)
            
            logger.info(f"Candidate screened from file: {candidate_id}, score: {screening_result['data']['match_score']}")
            
            return jsonify({
                "success": True,
                "candidate_id": candidate_id,
                "screening": screening_result["data"],
                "file_name": file.filename
            }), 201
            
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        logger.error(f"Error screening candidate file: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates', methods=['GET'])
@require_auth
def list_candidates(job_id):
    """
    GET /api/jobs/<job_id>/candidates
    List all candidates screened for a job.
    
    Response: {"success": true, "candidates": [{candidate_id, name, score, status, created_at}, ...]}
    """
    try:
        try:
            oid = ObjectId(job_id)
        except:
            return jsonify({"success": False, "error": "Invalid job ID format"}), 400
        
        company_id = request.company_id
        
        # Verify job exists
        job = db.jobs.find_one({
            "_id": oid,
            "company_id": company_id
        })
        
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        # Get candidates for this job
        candidates = db.candidates.find(
            {
                "job_id": job_id,
                "company_id": company_id
            },
            {"resume_text": 0}  # Exclude large field
        ).sort("created_at", -1)
        
        candidates_list = []
        for candidate in candidates:
            candidates_list.append({
                "candidate_id": str(candidate["_id"]),
                "name": candidate.get("resume_name") or candidate.get("candidate_name", "Unknown"),
                "email": candidate.get("candidate_email", ""),
                "match_score": candidate.get("screening", {}).get("match_score", 0),
                "status": candidate.get("status", "pending"),
                "created_at": candidate.get("created_at").isoformat() if candidate.get("created_at") else None,
                "final_decision": candidate.get("final_decision")
            })
        
        return jsonify({
            "success": True,
            "candidates": candidates_list
        }), 200
    
    except Exception as e:
        logger.error(f"Error listing candidates: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/candidates/<candidate_id>', methods=['GET'])
@require_auth
def get_candidate(candidate_id):
    """
    GET /api/jobs/candidates/<candidate_id>
    Get full candidate details including resume and screening results.
    
    Response: {"success": true, "candidate": {candidate_id, name, email, resume_text, screening, created_at}}
    """
    try:
        try:
            oid = ObjectId(candidate_id)
        except:
            return jsonify({"success": False, "error": "Invalid candidate ID format"}), 400
        
        company_id = request.company_id
        
        candidate = db.candidates.find_one({
            "_id": oid,
            "company_id": company_id
        })
        
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
        
        scheduling = candidate.get("scheduling")
        if scheduling:
            scheduling = dict(scheduling)
            if isinstance(scheduling.get("scheduled_date"), datetime):
                scheduling["scheduled_date"] = scheduling["scheduled_date"].isoformat()
            if isinstance(scheduling.get("notified_at"), datetime):
                scheduling["notified_at"] = scheduling["notified_at"].isoformat()

        return jsonify({
            "success": True,
            "candidate": {
                "candidate_id": str(candidate["_id"]),
                "job_id": str(candidate.get("job_id", "")),
                # resume_name = parsed from the uploaded PDF (most accurate)
                # candidate_name = typed by applicant in the form (fallback)
                "name": candidate.get("resume_name") or candidate.get("candidate_name", "Unknown"),
                "entered_name": candidate.get("candidate_name", ""),
                "email": candidate.get("candidate_email", ""),
                "resume_text": candidate.get("resume_text", ""),
                "photo_base64": candidate.get("photo_base64"),
                "screening": candidate.get("screening", {}),
                "status": candidate.get("status", "pending"),
                "interview_questions": candidate.get("interview_questions"),
                "scheduling": scheduling,
                "apply_token": candidate.get("apply_token"),
                "interview_token": candidate.get("interview_token"),
                "interview_token_expires_at": candidate.get("interview_token_expires_at").isoformat() if isinstance(candidate.get("interview_token_expires_at"), datetime) else candidate.get("interview_token_expires_at"),
                "interview_token_used": candidate.get("interview_token_used", False),
                "final_decision": candidate.get("final_decision"),
                "result_token": candidate.get("result_token"),
                "resume_source": candidate.get("resume_source"),
                "applied_at": candidate.get("applied_at").isoformat() if isinstance(candidate.get("applied_at"), datetime) else candidate.get("applied_at"),
                "created_at": candidate.get("created_at").isoformat() if candidate.get("created_at") else None
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting candidate: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates/<candidate_id>/shortlist', methods=['POST'])
@require_auth
def shortlist_candidate(job_id, candidate_id):
    """
    POST /api/jobs/<job_id>/candidates/<candidate_id>/shortlist
    Generate questions and send shortlist email for a candidate.
    """
    try:
        from agents.question_generator import QuestionGenerator
        from agents.email_sender import EmailSender, send_email_via_resend
        
        try:
            job_oid = ObjectId(job_id)
            candidate_oid = ObjectId(candidate_id)
        except:
            return jsonify({"success": False, "error": "Invalid ID format"}), 400
        
        company_id = request.company_id
        
        # Verify parent job matches company
        job = db.jobs.find_one({"_id": job_oid, "company_id": company_id})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        # Verify candidate matches company and parent job
        candidate = db.candidates.find_one({
            "_id": candidate_oid,
            "job_id": job_id,
            "company_id": company_id
        })
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
        
        if candidate.get("status") != "shortlist":
            return jsonify({
                "success": False,
                "error": f"Candidate status is '{candidate.get('status')}', not 'shortlist'"
            }), 400
        
        # Agent 3: Generate questions
        question_generator = QuestionGenerator(Config.GEMINI_API_KEY)
        questions_result = question_generator.generate(
            candidate_profile={"name": candidate.get("candidate_name", "Candidate")},
            jd_data=job.get("parsed", {}),
            screening_data=candidate.get("screening", {})
        )
        
        if not questions_result["success"]:
            return jsonify({
                "success": False,
                "error": f"Question generation failed: {questions_result['error']}"
            }), 400
        
        questions = questions_result["data"]["questions"]
        
        # Agent 4: Generate email
        email_sender = EmailSender(Config.GEMINI_API_KEY)
        request_data = request.get_json() or {}
        company_data = {
            "company_name": request_data.get("company_name", "Our Company"),
            "contact_email": request_data.get("recruiter_email", "hiring@company.com")
        }
        
        email_result = email_sender.generate_email(
            candidate_profile={
                "name": candidate.get("candidate_name", "Candidate"),
                "email": candidate.get("candidate_email", "")
            },
            jd_data=job.get("parsed", {}),
            company_data=company_data
        )
        
        if not email_result["success"]:
            return jsonify({
                "success": False,
                "error": f"Email generation failed: {email_result['error']}"
            }), 400
        
        email_content = email_result["data"]
        
        # Send email via Resend
        send_result = send_email_via_resend(
            recipient_email=candidate.get("candidate_email", ""),
            subject=email_content.get("subject", "Interview Invitation"),
            html_body=email_content.get("body_html", ""),
            company_name=company_data["company_name"],
            recruiter_email=company_data["contact_email"],
            resend_api_key=Config.RESEND_API_KEY
        )
        
        # Update candidate
        db.candidates.update_one(
            {"_id": candidate_oid, "company_id": company_id},
            {
                "$set": {
                    "interview_questions": questions,
                    "email_sent": send_result["success"],
                    "email_message_id": send_result.get("message_id"),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return jsonify({
            "success": True,
            "questions": questions,
            "email_sent": send_result["success"],
            "email_message_id": send_result.get("message_id"),
            "error": send_result.get("error")
        }), 200
    
    except Exception as e:
        logger.error(f"Error in shortlist flow: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates/<candidate_id>/evaluate', methods=['POST'])
@require_auth
def evaluate_candidate_answer(job_id, candidate_id):
    """
    POST /api/jobs/<job_id>/candidates/<candidate_id>/evaluate
    Evaluate an interview answer (speech or code) and make recommendation.
    
    Request:
    {
        "answer_type": "speech" or "code",
        "answer": "...",
        "question": "..."
    }
    
    Response:
    {
        "success": true/false,
        "evaluation": {...},
        "error": "..."
    }
    """
    try:
        from agents.answer_evaluator import AnswerEvaluator
        
        # Validate IDs
        try:
            job_oid = ObjectId(job_id)
            candidate_oid = ObjectId(candidate_id)
        except:
            return jsonify({"success": False, "error": "Invalid ID format"}), 400
        
        company_id = request.company_id
        
        # Get job - verify company matches
        job = db.jobs.find_one({
            "_id": job_oid,
            "company_id": company_id
        })
        
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        # Get candidate - verify company and parent job match
        candidate = db.candidates.find_one({
            "_id": candidate_oid,
            "job_id": job_id,
            "company_id": company_id
        })
        
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Request body is empty"}), 400
        
        answer_type = data.get('answer_type', 'speech').lower()
        answer = data.get('answer', '').strip()
        question = data.get('question', 'Interview question not provided')
        
        if not answer:
            return jsonify({"success": False, "error": "answer is required"}), 400
        
        if answer_type not in ['speech', 'code']:
            return jsonify({"success": False, "error": "answer_type must be 'speech' or 'code'"}), 400
        
        # Initialize Agent 5
        evaluator = AnswerEvaluator(Config.GEMINI_API_KEY)
        
        # Evaluate the answer
        logger.info(f"Evaluating {answer_type} answer for candidate {candidate_id}")
        evaluation_result = evaluator.evaluate(
            answer_data={
                "answer_type": answer_type,
                "answer": answer,
                "candidate_name": candidate.get("candidate_name", "Candidate")
            },
            question_data={
                "question": question,
                "category": data.get('category', 'technical')
            },
            jd_data=job.get("parsed", {})
        )
        
        if not evaluation_result["success"]:
            logger.error(f"Evaluation failed: {evaluation_result['error']}")
            return jsonify({
                "success": False,
                "error": f"Evaluation failed: {evaluation_result['error']}"
            }), 400
        
        evaluation = evaluation_result["data"]
        
        # Save evaluation to candidate document
        db.candidates.update_one(
            {"_id": candidate_oid, "company_id": company_id},
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
                        "question": question
                    }
                }
            }
        )
        
        logger.info(f"Candidate {candidate_id} evaluated: score={evaluation['evaluation_score']}, recommendation={evaluation['final_recommendation']}")
        
        return jsonify({
            "success": True,
            "evaluation": evaluation
        }), 200
    
    except Exception as e:
        logger.error(f"Error evaluating candidate: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates/<candidate_id>/evaluations', methods=['GET'])
@require_auth
def get_candidate_evaluations(job_id, candidate_id):
    """
    GET /api/jobs/<job_id>/candidates/<candidate_id>/evaluations
    Get all evaluations for a candidate.
    
    Response:
    {
        "success": true,
        "latest_evaluation": {...},
        "evaluation_history": [...]
    }
    """
    try:
        try:
            job_oid = ObjectId(job_id)
            candidate_oid = ObjectId(candidate_id)
        except:
            return jsonify({"success": False, "error": "Invalid ID format"}), 400
        
        company_id = request.company_id
        
        # Verify parent job matches company
        job = db.jobs.find_one({"_id": job_oid, "company_id": company_id})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
        
        # Verify candidate matches company and parent job
        candidate = db.candidates.find_one({
            "_id": candidate_oid,
            "job_id": job_id,
            "company_id": company_id
        })
        
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
        
        return jsonify({
            "success": True,
            "latest_evaluation": candidate.get("latest_evaluation"),
            "evaluation_history": candidate.get("evaluation_history", [])
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting evaluations: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@jobs_bp.route('/<job_id>/candidates/<candidate_id>/schedule', methods=['POST'])
@require_auth
def schedule_candidate(job_id, candidate_id):
    """
    POST /api/jobs/<job_id>/candidates/<candidate_id>/schedule
    Deterministically schedule the next step for a candidate based on their evaluation recommendation
    and seniority level, generate the notification email using Gemini, and send it.
    """
    try:
        from agents.scheduler import Scheduler
        from agents.notification_writer import NotificationWriter
        from agents.email_sender import send_email_via_resend
        
        try:
            job_oid = ObjectId(job_id)
            candidate_oid = ObjectId(candidate_id)
        except:
            return jsonify({"success": False, "error": "Invalid ID format"}), 400
            
        company_id = request.company_id
        
        # 1. Verify job belongs to company
        job = db.jobs.find_one({"_id": job_oid, "company_id": company_id})
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404
            
        # 2. Verify candidate belongs to company and job
        candidate = db.candidates.find_one({
            "_id": candidate_oid,
            "job_id": job_id,
            "company_id": company_id
        })
        if not candidate:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
            
        # 3. Read latest evaluation recommendation
        latest_evaluation = candidate.get("latest_evaluation")
        if not latest_evaluation:
            return jsonify({"success": False, "error": "Candidate has no evaluation to schedule from"}), 400
            
        recommendation = latest_evaluation.get("final_recommendation")
        if not recommendation:
            return jsonify({"success": False, "error": "Candidate has no evaluation to schedule from"}), 400
            
        # 4. Read job seniority level
        seniority_level = job.get("parsed", {}).get("seniority_level", "mid")
        
        # 5. Call Scheduler
        scheduler = Scheduler()
        decision = scheduler.decide_next_step(recommendation, seniority_level)
        
        next_step = decision["next_step"]
        scheduled_date = decision["scheduled_date"]
        
        # 6. Get company name
        company_doc = db.companies.find_one({"_id": ObjectId(company_id)})
        comp_name = company_doc.get("company_name", "Our Company") if company_doc else "Our Company"
        
        # 7. Call NotificationWriter
        writer = NotificationWriter(Config.GEMINI_API_KEY)
        write_result = writer.write_notification(
            next_step=next_step,
            candidate_name=candidate.get("candidate_name", "Candidate"),
            job_title=job.get("parsed", {}).get("job_title", "Position"),
            company_name=comp_name
        )
        
        email_sent = False
        email_error = None
        email_message_id = None
        
        if write_result["success"]:
            email_content = write_result["data"]
            # Send email via Resend
            send_res = send_email_via_resend(
                recipient_email=candidate.get("candidate_email", ""),
                subject=email_content.get("subject", "Application Update"),
                html_body=email_content.get("body_html", ""),
                company_name=comp_name,
                recruiter_email="hiring@hireflowai.com",
                resend_api_key=Config.RESEND_API_KEY
            )
            email_sent = send_res["success"]
            email_error = send_res.get("error")
            email_message_id = send_res.get("message_id")
        else:
            email_error = f"Failed to generate email: {write_result.get('error')}"
            
        # 8. Persist scheduling info
        scheduling_info = {
            "next_step": next_step,
            "scheduled_date": scheduled_date,
            "notified_at": datetime.utcnow() if email_sent else None,
            "email_sent": email_sent,
            "email_error": email_error,
            "email_message_id": email_message_id
        }
        
        db.candidates.update_one(
            {"_id": candidate_oid, "company_id": company_id},
            {
                "$set": {
                    "scheduling": scheduling_info,
                    "status": next_step,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Serialize datetime fields
        scheduling_info["scheduled_date"] = scheduled_date.isoformat()
        if scheduling_info["notified_at"]:
            scheduling_info["notified_at"] = scheduling_info["notified_at"].isoformat()
            
        return jsonify({
            "success": True,
            "scheduling": scheduling_info,
            "email_sent": email_sent,
            "error": email_error
        }), 200
        
    except Exception as e:
        logger.error(f"Error in scheduler endpoint: {e}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {e}"}), 500