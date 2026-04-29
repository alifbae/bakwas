"""
Utility functions and shared helpers.
"""

import os


def is_debug_mode():
    """Check if debug mode is enabled via environment variable"""
    return os.getenv("DEBUG", "False").lower() == "true"


def get_port():
    """Get the port from environment variable with default"""
    return int(os.getenv("PORT", 5000))
