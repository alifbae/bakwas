"""
Bakwas - YouTube Video Summarizer
Main Flask application controller
"""

import os
import secrets
import traceback

import litellm
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman

# Import custom modules
from src.database import (
    delete_summary,
    get_all_summaries,
    get_summary_by_id,
    init_db,
    save_summary,
)
from src.subtitles import get_video_info
from src.summarizer import fetch_anthropic_models, summarize_text
from src.utils import get_port, is_debug_mode

# Load environment variables
load_dotenv()

# Get the project root directory (parent of src/)
import pathlib

project_root = pathlib.Path(__file__).parent.parent

# Initialize Flask with correct template and static paths
app = Flask(
    __name__,
    template_folder=str(project_root / "templates"),
    static_folder=str(project_root / "static"),
)

# Security: Set SECRET_KEY for session management
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(32))

# Security: Add security headers
csp = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "code.jquery.com", "cdn.jsdelivr.net"],
    "style-src": [
        "'self'",
        "'unsafe-inline'",
        "cdn.jsdelivr.net",
        "fonts.googleapis.com",
    ],
    "font-src": ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
    "img-src": ["'self'", "data:"],
}
Talisman(app, content_security_policy=csp, force_https=False)

# Security: Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Initialize database
init_db()

# Enable verbose logging only if DEBUG env var is set
if is_debug_mode():
    litellm.set_verbose = True

# Cache available models at startup
ANTHROPIC_MODELS = fetch_anthropic_models()


@app.route("/")
def index():
    """Homepage showing all summaries"""
    summaries = get_all_summaries()
    return render_template("index.html", summaries=summaries)


@app.route("/models", methods=["GET"])
def get_models():
    """Return cached available models"""
    return jsonify({"models": ANTHROPIC_MODELS})


@app.route("/summarize", methods=["POST"])
@limiter.limit("10 per hour")  # Rate limit: 10 summaries per hour per IP
def summarize():
    """Main endpoint to summarize a YouTube video"""
    url = request.form.get("url")
    model = request.form.get("model", "anthropic/claude-sonnet-4-6")
    length = request.form.get("length", "comprehensive")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        # Extract video info and captions
        video_info = get_video_info(url)
        if not video_info["captions"]:
            return jsonify({"error": "No captions found"}), 404

        # Summarize
        summary = summarize_text(video_info["captions"], model=model, length=length)

        # Save to database
        save_summary(
            url=url,
            title=video_info["title"],
            creator=video_info["creator"],
            video_date=video_info["video_date"],
            subtitles=video_info["captions"],
            summary=summary,
            model_used=model,
            summary_length=length,
        )

        return jsonify(
            {
                "summary": summary,
                "title": video_info["title"],
                "creator": video_info["creator"],
                "video_date": video_info["video_date"],
                "caption_length": len(video_info["captions"].split()),
                "model_used": model,
                "summary_length": length,
            }
        )

    except ValueError as e:
        # User input validation errors (e.g., invalid URL)
        return jsonify({"error": "Invalid request. Please check your input."}), 400
    except Exception as e:
        # Log detailed error server-side
        print(f"Error in summarize: {str(e)}")
        if is_debug_mode():
            traceback.print_exc()

        # Return generic error to client
        return (
            jsonify(
                {
                    "error": "An error occurred while processing your request. Please try again."
                }
            ),
            500,
        )


@app.route("/summary/<int:summary_id>")
def view_summary(summary_id):
    """View detailed summary page"""
    summary = get_summary_by_id(summary_id)
    if not summary:
        return "Summary not found", 404
    return render_template("detail.html", summary=summary)


@app.route("/summary/<int:summary_id>/delete", methods=["POST"])
def delete_summary_route(summary_id):
    """Delete a summary"""
    if delete_summary(summary_id):
        return redirect(url_for("index"))
    return "Summary not found", 404


@app.route("/health")
def health():
    """Health check endpoint for monitoring"""
    return jsonify({"status": "healthy"}), 200
