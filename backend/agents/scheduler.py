"""
backend/agents/scheduler.py
Deterministic rule engine for automated next-step candidate decisions.
"""

from datetime import datetime, timedelta

SCHEDULER_DECISION_RULES = {
    ("strong_hire", "senior"):          {"next_step": "offer",         "delay_days": 1},
    ("strong_hire", "mid"):             {"next_step": "l2_technical",  "delay_days": 3},
    ("strong_hire", "junior"):          {"next_step": "l2_technical",  "delay_days": 3},
    ("move_to_next_round", "senior"):   {"next_step": "hr_round",      "delay_days": 3},
    ("move_to_next_round", "mid"):      {"next_step": "l2_technical",  "delay_days": 5},
    ("move_to_next_round", "junior"):   {"next_step": "hr_round",      "delay_days": 5},
    ("review", "senior"):               {"next_step": "hr_review",     "delay_days": 2},
    ("review", "mid"):                  {"next_step": "hold",          "delay_days": 7},
    ("review", "junior"):               {"next_step": "hold",          "delay_days": 7},
    ("reject", "senior"):               {"next_step": "reject",        "delay_days": 0},
    ("reject", "mid"):                  {"next_step": "reject",        "delay_days": 0},
    ("reject", "junior"):               {"next_step": "reject",        "delay_days": 0},
}

DEFAULT_DECISION = {"next_step": "hold", "delay_days": 7}

class Scheduler:
    def decide_next_step(self, recommendation: str, seniority_level: str) -> dict:
        """
        Determines the next step and delay date based on the evaluation recommendation
        and job seniority level.
        """
        rec = (recommendation or "").strip().lower()
        sen = (seniority_level or "").strip().lower()
        
        # Exact lookup in rules table
        decision = SCHEDULER_DECISION_RULES.get((rec, sen))
        if not decision:
            # Try fallback by matching recommendation only with default seniority level if needed
            decision = DEFAULT_DECISION
            
        next_step = decision["next_step"]
        delay_days = decision["delay_days"]
        scheduled_date = datetime.utcnow() + timedelta(days=delay_days)
        
        return {
            "next_step": next_step,
            "scheduled_date": scheduled_date,
            "recommendation": recommendation
        }
