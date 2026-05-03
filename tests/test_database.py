"""Database-layer tests (in-memory-ish via BAKWAS_DB_PATH temp file)."""

import importlib

import pytest


@pytest.fixture
def db(temp_db_path):
    # Re-import so module-level DATABASE_PATH picks up the temp path.
    from src import database

    importlib.reload(database)
    database.init_db()
    return database


def _seed(db, **overrides):
    params = dict(
        url="https://www.youtube.com/watch?v=abc",
        title="Test Title",
        creator="Test Creator",
        video_date="2025-01-01",
        subtitles="one two three",
        summary="A short summary.",
        model_used="openai/gpt-4o-mini",
        summary_length="concise",
        prompt_tokens=10,
        completion_tokens=5,
        cost_usd=0.0001,
        duration_seconds=60,
    )
    params.update(overrides)
    db.save_summary(**params)


class TestSaveAndFetch:
    def test_save_then_get_cached_summary(self, db):
        _seed(db)
        row = db.get_cached_summary(
            "https://www.youtube.com/watch?v=abc",
            "openai/gpt-4o-mini",
            "concise",
        )
        assert row is not None
        assert row["title"] == "Test Title"
        assert row["prompt_tokens"] == 10

    def test_upsert_replaces_existing(self, db):
        _seed(db, summary="first")
        _seed(db, summary="second")
        row = db.get_cached_summary(
            "https://www.youtube.com/watch?v=abc",
            "openai/gpt-4o-mini",
            "concise",
        )
        assert row["summary"] == "second"


class TestGetAllSummaries:
    def test_pagination(self, db):
        for i in range(5):
            _seed(db, url=f"https://www.youtube.com/watch?v=v{i}", title=f"Video {i}")
        page1 = db.get_all_summaries(per_page=2, page=1)
        assert page1["total"] == 5
        assert len(page1["items"]) == 2
        assert page1["total_pages"] == 3

    def test_invalid_sort_falls_back(self, db):
        _seed(db)
        # Unknown sort columns should be ignored rather than blowing up.
        result = db.get_all_summaries(sort_by="DROP TABLE", sort_dir="sideways")
        assert result["total"] == 1


class TestDelete:
    def test_delete_returns_true_for_existing(self, db):
        _seed(db)
        summary_id = db.get_all_summaries()["items"][0]["id"]
        assert db.delete_summary(summary_id) is True

    def test_delete_returns_false_for_missing(self, db):
        assert db.delete_summary(9999) is False


class TestCostStats:
    def test_aggregates(self, db):
        _seed(db, url="u1", cost_usd=0.10, prompt_tokens=100, completion_tokens=50)
        _seed(db, url="u2", cost_usd=0.05, prompt_tokens=20, completion_tokens=10)
        _seed(db, url="u3", cost_usd=None, prompt_tokens=None, completion_tokens=None)
        stats = db.get_cost_stats()
        assert stats["total_summaries"] == 3
        assert stats["priced_summaries"] == 2
        assert stats["total_cost_usd"] == pytest.approx(0.15)
        assert stats["total_prompt_tokens"] == 120
        assert stats["total_completion_tokens"] == 60
