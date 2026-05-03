"""Flask route happy paths + a couple of error cases.

External services (yt-dlp, LiteLLM) are not reachable from tests; we never
hit /summarize live. Instead we seed the DB directly and exercise the cache
hit path for /summarize, and hit the read-only endpoints unmocked.
"""

import importlib


def _seed_summary(temp_db_path, **overrides):
    from src import database

    importlib.reload(database)
    params = dict(
        url="https://www.youtube.com/watch?v=abc",
        title="Seeded title",
        creator="Seeded creator",
        video_date="2025-01-01",
        subtitles="one two three four five",
        summary="seeded summary",
        model_used="openai/gpt-4o-mini",
        summary_length="concise",
        prompt_tokens=1,
        completion_tokens=1,
        cost_usd=0.01,
    )
    params.update(overrides)
    database.save_summary(**params)


class TestReadOnlyRoutes:
    def test_health(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.get_json() == {"status": "healthy"}

    def test_models_returns_list(self, client):
        res = client.get("/models")
        assert res.status_code == 200
        assert "models" in res.get_json()

    def test_stats_returns_zero_for_empty_db(self, client):
        res = client.get("/stats")
        assert res.status_code == 200
        data = res.get_json()
        assert data["total_summaries"] == 0
        assert data["total_cost_usd"] == 0.0

    def test_search_returns_seeded_summary(self, client, temp_db_path):
        _seed_summary(temp_db_path)
        res = client.get("/search")
        assert res.status_code == 200
        summaries = res.get_json()["summaries"]
        assert len(summaries) == 1
        assert summaries[0]["title"] == "Seeded title"


class TestSummaryDetail:
    def test_404_for_missing(self, client):
        res = client.get("/summary/999999")
        assert res.status_code == 404

    def test_detail_renders_for_existing(self, client, temp_db_path):
        _seed_summary(temp_db_path, url="https://www.youtube.com/watch?v=detail")
        from src import database

        summary_id = database.get_all_summaries()["items"][0]["id"]
        res = client.get(f"/summary/{summary_id}")
        assert res.status_code == 200
        assert b"Seeded title" in res.data


class TestSummarizeCacheHit:
    """We only exercise the cache-hit path so we never touch yt-dlp/LiteLLM."""

    def test_cache_hit_returns_seeded_summary(self, client, temp_db_path):
        _seed_summary(temp_db_path, url="https://www.youtube.com/watch?v=cache")
        res = client.post(
            "/summarize",
            data={
                "url": "https://www.youtube.com/watch?v=cache",
                "model": "openai/gpt-4o-mini",
                "length": "concise",
            },
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is True
        assert data["summary"] == "seeded summary"

    def test_missing_url_returns_400(self, client):
        res = client.post("/summarize", data={})
        assert res.status_code == 400
        assert "error" in res.get_json()


class TestErrorHandlers:
    def test_unknown_route_404_page(self, client):
        res = client.get("/nope-nothing-here")
        assert res.status_code == 404
