import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

# Use data directory if it exists (for Docker), otherwise current directory
DATA_DIR = "data" if os.path.exists("data") else "."
DATABASE_PATH = os.path.join(DATA_DIR, "summaries.db")


@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database with required tables"""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL UNIQUE,
                title TEXT,
                creator TEXT,
                video_date TEXT,
                subtitles TEXT,
                summary TEXT NOT NULL,
                model_used TEXT,
                summary_length TEXT DEFAULT 'shortest',
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                cost_usd REAL,
                duration_seconds INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Add summary_length column to existing tables if it doesn't exist
        try:
            conn.execute(
                'ALTER TABLE summaries ADD COLUMN summary_length TEXT DEFAULT "shortest"'
            )
        except:
            pass  # Column already exists

        # Token and cost tracking columns added in a later revision; add them
        # to pre-existing databases one by one (SQLite doesn't support
        # IF NOT EXISTS on ALTER TABLE ADD COLUMN).
        for ddl in (
            "ALTER TABLE summaries ADD COLUMN prompt_tokens INTEGER",
            "ALTER TABLE summaries ADD COLUMN completion_tokens INTEGER",
            "ALTER TABLE summaries ADD COLUMN cost_usd REAL",
            "ALTER TABLE summaries ADD COLUMN duration_seconds INTEGER",
        ):
            try:
                conn.execute(ddl)
            except Exception:
                pass  # Column already exists


def save_summary(
    url,
    title,
    creator,
    video_date,
    subtitles,
    summary,
    model_used,
    summary_length="shortest",
    prompt_tokens=None,
    completion_tokens=None,
    cost_usd=None,
    duration_seconds=None,
):
    """Save or update a summary in the database"""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO summaries (
                url, title, creator, video_date, subtitles, summary,
                model_used, summary_length, prompt_tokens, completion_tokens, cost_usd, duration_seconds
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                creator = excluded.creator,
                video_date = excluded.video_date,
                subtitles = excluded.subtitles,
                summary = excluded.summary,
                model_used = excluded.model_used,
                summary_length = excluded.summary_length,
                prompt_tokens = excluded.prompt_tokens,
                completion_tokens = excluded.completion_tokens,
                cost_usd = excluded.cost_usd,
                duration_seconds = excluded.duration_seconds,
                created_at = CURRENT_TIMESTAMP
        """,
            (
                url,
                title,
                creator,
                video_date,
                subtitles,
                summary,
                model_used,
                summary_length,
                prompt_tokens,
                completion_tokens,
                cost_usd,
                duration_seconds,
            ),
        )


def get_all_summaries(
    sort_by="created_at",
    sort_dir="desc",
    page=1,
    per_page=None,
):
    """
    Get summaries ordered by the given column and direction, with optional pagination.

    Args:
        sort_by: one of 'title', 'creator', 'video_date', 'summary_length',
                 'model_used', 'created_at'. Invalid values fall back to 'created_at'.
        sort_dir: 'asc' or 'desc'. Invalid values fall back to 'desc'.
        page: 1-based page number.
        per_page: number of rows per page. None (or <= 0) returns all rows.

    Returns:
        dict with keys:
            items: list of summary dicts
            total: total number of rows
            page: current page (1-based)
            per_page: page size (None if unpaginated)
            total_pages: number of pages (1 if unpaginated)
    """
    allowed_columns = {
        "title",
        "creator",
        "video_date",
        "summary_length",
        "model_used",
        "created_at",
    }
    if sort_by not in allowed_columns:
        sort_by = "created_at"

    sort_dir = (sort_dir or "").lower()
    if sort_dir not in {"asc", "desc"}:
        sort_dir = "desc"

    # Build ORDER BY safely: both values are whitelisted.
    # Use a stable secondary sort on created_at desc to keep ordering deterministic
    # when the primary column has duplicates.
    order_clause = f"{sort_by} {sort_dir.upper()}"
    if sort_by != "created_at":
        order_clause += ", created_at DESC"

    with get_db() as conn:
        # Total count (for pagination UI)
        total = conn.execute("SELECT COUNT(*) FROM summaries").fetchone()[0]

        base_query = f"""
            SELECT id, url, title, creator, video_date, model_used, summary_length, created_at,
                   substr(summary, 1, 150) as summary_preview
            FROM summaries
            ORDER BY {order_clause}
        """

        if per_page and per_page > 0:
            page = max(1, int(page or 1))
            offset = (page - 1) * per_page
            cursor = conn.execute(
                base_query + " LIMIT ? OFFSET ?",
                (per_page, offset),
            )
            total_pages = max(1, (total + per_page - 1) // per_page) if total else 1
        else:
            cursor = conn.execute(base_query)
            page = 1
            total_pages = 1

        items = [dict(row) for row in cursor.fetchall()]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


def get_summary_by_id(summary_id):
    """Get a specific summary by ID"""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM summaries WHERE id = ?
        """,
            (summary_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_cached_summary(url, model_used, summary_length):
    """
    Return a cached summary row matching url + model + length, or None.
    Used to avoid regenerating summaries for the exact same request.
    """
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM summaries
            WHERE url = ? AND model_used = ? AND summary_length = ?
            LIMIT 1
            """,
            (url, model_used, summary_length),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_cost_stats():
    """
    Return aggregate cost/token stats across all summaries.

    Returns a dict with:
        total_summaries:            total rows
        priced_summaries:           rows that have a cost_usd value
        total_cost_usd:             sum of cost_usd (float, 0.0 if none)
        total_prompt_tokens:        sum of prompt_tokens
        total_completion_tokens:    sum of completion_tokens
    """
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*)                                   AS total_summaries,
                SUM(CASE WHEN cost_usd IS NOT NULL THEN 1 ELSE 0 END) AS priced_summaries,
                COALESCE(SUM(cost_usd), 0.0)               AS total_cost_usd,
                COALESCE(SUM(prompt_tokens), 0)            AS total_prompt_tokens,
                COALESCE(SUM(completion_tokens), 0)        AS total_completion_tokens
            FROM summaries
            """
        ).fetchone()
        return {
            "total_summaries": int(row["total_summaries"] or 0),
            "priced_summaries": int(row["priced_summaries"] or 0),
            "total_cost_usd": float(row["total_cost_usd"] or 0.0),
            "total_prompt_tokens": int(row["total_prompt_tokens"] or 0),
            "total_completion_tokens": int(row["total_completion_tokens"] or 0),
        }


def delete_summary(summary_id):
    """Delete a summary by ID"""
    with get_db() as conn:
        conn.execute("DELETE FROM summaries WHERE id = ?", (summary_id,))
        return conn.total_changes > 0
