"""Base Agent class for all AI agents in HireFlow AI.

Production rules
────────────────
- NO mock fallbacks. If the LLM fails, raise an exception so Celery can retry.
- Rate-limit errors (RESOURCE_EXHAUSTED / 429) are treated as transient and
  re-raised so the Celery task backs off and retries with exponential delay.
- JSON parse / validation errors are returned as {"success": False, "error": ...}
  so the pipeline can decide whether to retry or permanently fail.
"""

import json
import re
import logging
from typing import Optional, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)


class BaseAgent:
    """
    Universal agent skeleton that all AI agents inherit from.

    Every agent follows the same pattern:
    - Takes structured input
    - Calls Gemini LLM with a prompt template
    - Parses and validates JSON output
    - Returns a consistent response envelope

    This class handles all complexity (error handling, logging).
    Subclasses only define: prompt_template, temperature, required_fields.

    Retry strategy (Celery-aware)
    ─────────────────────────────
    Transient errors (rate limits, network, LLM timeouts) → RAISE so the
    Celery task retries with exponential back-off. Never swallow these.

    Business errors (empty input, JSON parse fail) → return
    {"success": False} so the pipeline can decide to retry or permanently fail.
    """

    def __init__(self, api_key: str, temperature: float = 0.1):
        """
        Initialize the agent with Gemini LLM.

        Args:
            api_key:     Gemini API key from environment
            temperature: 0.1 for deterministic scoring, 0.7 for creative writing
        """
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=temperature,
        )
        self.temperature = temperature
        logger.info("BaseAgent initialized with temperature=%s", temperature)

    def invoke(
        self,
        prompt_template: str,
        variables: Dict[str, Any],
        required_fields: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Universal invocation method for any agent.

        Steps:
        1. Fill the prompt template with variables
        2. Call Gemini LLM
        3. Strip markdown fences (LLMs add ```json even when told not to)
        4. Parse JSON
        5. Validate required fields
        6. Return {"success": True/False, "data": ..., "error": ...}

        Transient errors (rate limits, connectivity) are RE-RAISED so the
        Celery task wrapper can schedule a retry with back-off.
        """
        raw = ""  # always initialise before try block

        try:
            # Step 1: Build prompt
            prompt = PromptTemplate(
                input_variables=list(variables.keys()),
                template=prompt_template,
            )

            logger.debug("Invoking LLM with variables: %s", list(variables.keys()))

            # Step 2: Call LLM
            chain = prompt | self.llm
            response = chain.invoke(variables)

            # Step 3: Extract text + strip markdown fences
            raw = response.content.strip()
            raw = re.sub(r"```json\s*|\s*```", "", raw).strip()

            # Step 4: Parse JSON
            parsed = json.loads(raw)

            # Step 5: Validate required fields
            if required_fields:
                for field in required_fields:
                    if field not in parsed:
                        raise ValueError(f"Missing required field: '{field}'")

            # Step 6: Return success envelope
            logger.info("LLM invocation successful (%d fields returned)", len(parsed))
            return {
                "success": True,
                "data": parsed,
                "error": None,
                "raw_response": raw,
            }

        except Exception as exc:
            error_str = str(exc)

            # ── Transient / infrastructure errors → RAISE for Celery retry ──
            is_transient = (
                "RESOURCE_EXHAUSTED" in error_str
                or "quota" in error_str.lower()
                or "429" in error_str
                or "503" in error_str
                or "timeout" in error_str.lower()
                or "connection" in error_str.lower()
            )

            if is_transient:
                # Re-raise as RuntimeError so Celery's retry logic picks it up.
                # NEVER fall back to fake data — that would silently corrupt results.
                logger.warning(
                    "Transient LLM error — propagating for Celery retry: %s", exc
                )
                raise RuntimeError(
                    f"Gemini API transient error (Celery will retry): {exc}"
                ) from exc

            # ── Business / parse errors → return failure envelope ──────────
            if isinstance(exc, json.JSONDecodeError):
                error_msg = f"JSON parsing failed: {exc}"
            elif isinstance(exc, ValueError):
                error_msg = f"Validation failed: {exc}"
            else:
                error_msg = f"Unexpected LLM error: {exc}"

            logger.error("%s | raw_response[:300]=%s", error_msg, raw[:300])
            return {
                "success": False,
                "data": None,
                "error": error_msg,
                "raw_response": raw,
            }