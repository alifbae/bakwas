"""
Entry point for running the Bakwas application
"""

from src.app import app
from src.utils import get_port, is_debug_mode

if __name__ == "__main__":
    port = get_port()
    app.run(debug=is_debug_mode(), host="0.0.0.0", port=port)
