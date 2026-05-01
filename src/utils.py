"""
Utility functions and shared helpers.
"""

import os


def is_debug_mode():
    """Check if debug mode is enabled via environment variable"""
    return os.getenv("DEBUG", "False").lower() == "true"


def is_local():
    """
    Check if the app is running in a local/development environment.
    True when DEBUG=true, FLASK_ENV=development, or LOCAL=true.
    """
    if is_debug_mode():
        return True
    if os.getenv("FLASK_ENV", "").lower() == "development":
        return True
    if os.getenv("LOCAL", "False").lower() == "true":
        return True
    return False


def get_port():
    """Get the port from environment variable with default"""
    return int(os.getenv("PORT", 5000))


def get_rate_limit_summarize():
    """
    Return the rate-limit string for the /summarize endpoint.

    Configured via the RATE_LIMIT_SUMMARIZE env var. Supports any expression
    Flask-Limiter accepts, e.g. "30 per hour", "5 per minute;100 per day".
    Defaults to a fairly tolerant "30 per hour" so casual use doesn't hit 429s.
    """
    return os.getenv("RATE_LIMIT_SUMMARIZE", "30 per hour").strip() or "30 per hour"
