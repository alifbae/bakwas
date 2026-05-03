"""Pure-function tests for src/subtitles.py."""

from src.subtitles import (
    canonicalize_youtube_url,
    extract_video_id,
    validate_youtube_url,
)


class TestExtractVideoId:
    def test_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_shorts(self):
        assert extract_video_id("https://www.youtube.com/shorts/abc123") == "abc123"

    def test_embed(self):
        assert extract_video_id("https://www.youtube.com/embed/abc123") == "abc123"

    def test_mobile(self):
        assert extract_video_id("https://m.youtube.com/watch?v=xyz") == "xyz"

    def test_non_youtube(self):
        assert extract_video_id("https://example.com/video/123") is None

    def test_malformed(self):
        assert extract_video_id("not a url") is None


class TestCanonicalizeYoutubeUrl:
    def test_round_trips_to_watch_form(self):
        assert canonicalize_youtube_url("https://youtu.be/abc") == "https://www.youtube.com/watch?v=abc"

    def test_preserves_unknown_input(self):
        # Falls back to the original when no ID can be extracted.
        assert canonicalize_youtube_url("https://example.com/foo") == "https://example.com/foo"


class TestValidateYoutubeUrl:
    def test_accepts_youtube_domains(self):
        assert validate_youtube_url("https://www.youtube.com/watch?v=abc")
        assert validate_youtube_url("https://youtu.be/abc")

    def test_rejects_other_domains(self):
        assert not validate_youtube_url("https://evil.example.com/")
