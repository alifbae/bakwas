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


def save_summary(
    url,
    title,
    creator,
    video_date,
    subtitles,
    summary,
    model_used,
    summary_length="shortest",
):
    """Save or update a summary in the database"""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO summaries (url, title, creator, video_date, subtitles, summary, model_used, summary_length)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                creator = excluded.creator,
                video_date = excluded.video_date,
                subtitles = excluded.subtitles,
                summary = excluded.summary,
                model_used = excluded.model_used,
                summary_length = excluded.summary_length,
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
            ),
        )


def get_all_summaries():
    """Get all summaries ordered by creation date"""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT id, url, title, creator, video_date, model_used, summary_length, created_at,
                   substr(summary, 1, 150) as summary_preview
            FROM summaries
            ORDER BY created_at DESC
        """
        )
        return [dict(row) for row in cursor.fetchall()]


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


def delete_summary(summary_id):
    """Delete a summary by ID"""
    with get_db() as conn:
        conn.execute("DELETE FROM summaries WHERE id = ?", (summary_id,))
        return conn.total_changes > 0
