import logging
from config import Config

logger = logging.getLogger(__name__)


def compute_final_score(evaluation_history: list) -> float:
    """
    Compute the average score across all answered questions in the session history.
    """
    if not evaluation_history:
        return 0.0
        
    scores = []
    for hist in evaluation_history:
        eval_data = hist.get("evaluation")
        if isinstance(eval_data, dict):
            score = eval_data.get("evaluation_score")
            if score is not None:
                try:
                    scores.append(float(score))
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert evaluation_score '{score}' to float.")
                    
    if not scores:
        return 0.0
        
    # Calculate simple average
    return round(sum(scores) / len(scores), 2)


def decide_outcome(final_score: float, threshold: float = None) -> str:
    """
    Return "offer" if score >= threshold, else "reject".
    """
    if threshold is None:
        threshold = Config.HIRE_THRESHOLD
        
    logger.info(f"Deciding candidate outcome: final_score={final_score}, threshold={threshold}")
    
    if final_score >= threshold:
        return "offer"
    else:
        return "reject"
