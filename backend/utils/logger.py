"""
backend/utils/logger.py

Centralized logging utility for HireFlow AI.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE")


def setup_logger(name: str) -> logging.Logger:
    """
    Create and configure a logger.

    Args:
        name: Logger name.

    Returns:
        Configured logger instance.
    """

    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)

    if LOG_FILE:
        file_handler = logging.FileHandler(LOG_FILE)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    logger.propagate = False

    return logger


def log_agent_invocation(
    logger: logging.Logger,
    agent_name: str,
    input_summary: str,
    success: bool,
    execution_time: Optional[float] = None,
) -> None:
    """
    Log an AI agent invocation.
    """

    message = (
        f"Agent={agent_name} | "
        f"Success={success} | "
        f"Input={input_summary}"
    )

    if execution_time is not None:
        message += f" | Time={execution_time:.2f}s"

    logger.info(message)


def log_error(
    logger: logging.Logger,
    context: str,
    error: Exception | str,
    extra: Optional[Any] = None,
) -> None:
    """
    Log an error with optional context.
    """

    message = f"{context} | Error={error}"

    if extra is not None:
        message += f" | Extra={extra}"

    logger.error(message)

