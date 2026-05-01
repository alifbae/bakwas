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
    get_cached_summary,
    get_summary_by_id,
    init_db,
    save_summary,
)
from src.providers import list_models as list_provider_models
from src.subtitles import canonicalize_youtube_url, get_video_info
from src.summarizer import summarize_text
from src.utils import (
    get_port,
    get_rate_limit_summarize,
    is_debug_mode,
    is_local,
)

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


def _compute_asset_version() -> str:
    """
    Stable version string used to bust browser caches for local static assets.
    Derived from the newest modification time across static/css and static/js.
    The version changes only when a file is edited, so browsers can cache
    aggressively between deploys without manual cache invalidation.
    """
    newest = 0.0
    for subdir in ("css", "js"):
        folder = project_root / "static" / subdir
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if path.is_file():
                try:
                    newest = max(newest, path.stat().st_mtime)
                except OSError:
                    continue
    # Seconds-precision integer keeps the URL short and stable.
    return str(int(newest)) if newest else "0"


ASSET_VERSION = _compute_asset_version()


@app.context_processor
def inject_asset_version():
    """Expose ASSET_VERSION to every template as `asset_version`."""
    return {"asset_version": ASSET_VERSION}

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

# Rate limiting: only applied to expensive endpoints (see @limiter.limit below).
# No global default limits, so cheap endpoints like /, /models, /health, and
# static assets are never throttled. Local/dev is always exempt.
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://",
)

SUMMARIZE_RATE_LIMIT = get_rate_limit_summarize()

# Initialize database
init_db()

# Enable verbose logging only if DEBUG env var is set
if is_debug_mode():
    litellm.set_verbose = True

# Cache the provider-driven model list at startup. If config/providers.yaml
# is missing or empty, AVAILABLE_MODELS will be [] and the UI will show
# "No models configured". Drop a config file in to fix.
AVAILABLE_MODELS = list_provider_models()
if not AVAILABLE_MODELS:
    print(
        "[bakwas] No enabled providers. Set at least one provider API key in .env "
        "(e.g. ANTHROPIC_API_KEY). See README.md for the full list."
    )


@app.route("/")
def index():
    """Homepage showing all summaries with server-side sorting and pagination."""
    # Parse & sanitize query params
    sort_by = request.args.get("sort", "created_at")
    sort_dir = request.args.get("dir", "desc")

    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1

    per_page_raw = request.args.get("per_page")
    per_page = None
    if per_page_raw is not None:
        # Explicit "all" keyword disables pagination.
        if str(per_page_raw).lower() == "all":
            per_page = None
        else:
            try:
                per_page = int(per_page_raw)
            except (TypeError, ValueError):
                per_page = None
            if per_page is not None:
                # Clamp to sane bounds. 0 / negative disables pagination.
                if per_page <= 0:
                    per_page = None
                else:
                    per_page = min(per_page, 200)

    result = get_all_summaries(
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        per_page=per_page,
    )

    # Normalize sort values to what the DB layer actually used, so the template
    # renders arrows for the effective sort even if the user passed garbage.
    allowed_sort_keys = {
        "title",
        "creator",
        "video_date",
        "summary_length",
        "model_used",
        "created_at",
    }
    effective_sort = sort_by if sort_by in allowed_sort_keys else "created_at"
    effective_dir = (
        sort_dir.lower()
        if isinstance(sort_dir, str) and sort_dir.lower() in {"asc", "desc"}
        else "desc"
    )

    return render_template(
        "index.html",
        summaries=result["items"],
        pagination={
            "total": result["total"],
            "page": result["page"],
            "per_page": result["per_page"],
            "total_pages": result["total_pages"],
        },
        sort_by=effective_sort,
        sort_dir=effective_dir,
    )


@app.route("/models", methods=["GET"])
def get_models():
    """Return cached available models"""
    return jsonify({"models": AVAILABLE_MODELS})


@app.route("/summarize", methods=["POST"])
@limiter.limit(SUMMARIZE_RATE_LIMIT, exempt_when=is_local)
def summarize():
    """Main endpoint to summarize a YouTube video"""
    url = request.form.get("url")
    model = request.form.get("model") or ""
    length = request.form.get("length", "comprehensive")
    force = str(request.form.get("force", "")).lower() in {"1", "true", "yes"}

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    # Fall back to the default configured model if the client didn't send one.
    if not model:
        default_model = next(
            (m["id"] for m in AVAILABLE_MODELS if m.get("default")),
            AVAILABLE_MODELS[0]["id"] if AVAILABLE_MODELS else None,
        )
        if not default_model:
            return (
                jsonify(
                    {
                        "error": "No LLM providers are configured. "
                        "Add at least one provider to config/providers.yaml."
                    }
                ),
                503,
            )
        model = default_model

    # Canonicalize URL so different forms of the same video share a cache entry
    canonical_url = canonicalize_youtube_url(url)

    # Cache hit: skip external calls and LLM cost when we already have
    # a summary for this exact url + model + length combination.
    # Regenerate requests pass force=true to bypass the cache entirely.
    cached = None
    if not force:
        cached = get_cached_summary(canonical_url, model, length)
        if cached is None and canonical_url != url:
            # Fall back to legacy rows saved before URL canonicalization
            cached = get_cached_summary(url, model, length)

    if cached:
        return jsonify(
            {
                "summary": cached["summary"],
                "title": cached.get("title") or "",
                "creator": cached.get("creator") or "",
                "video_date": cached.get("video_date") or "",
                "caption_length": len((cached.get("subtitles") or "").split()),
                "model_used": cached.get("model_used") or model,
                "summary_length": cached.get("summary_length") or length,
                "cached": True,
            }
        )

    try:
        # Extract video info and captions
        video_info = get_video_info(canonical_url)
        if not video_info["captions"]:
            return jsonify({"error": "No captions found"}), 404

        # Summarize
        summary = summarize_text(video_info["captions"], model=model, length=length)

        # Save to database using canonical URL so future lookups hit
        save_summary(
            url=canonical_url,
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
                "cached": False,
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
    """Health check endpoint for monitoring."""
    return jsonify({"status": "healthy"}), 200
