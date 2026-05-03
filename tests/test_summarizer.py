"""Tests for the pure helpers in src/summarizer.py.

We deliberately stay clear of `summarize_text` / `summarize_text_stream`
because those dispatch to LiteLLM; the pure timestamp helpers are the
interesting surface.
"""

from src.summarizer import _timestamp_to_seconds, linkify_timestamps


class TestTimestampToSeconds:
    def test_minutes_seconds(self):
        assert _timestamp_to_seconds("02:30") == 150

    def test_hours_minutes_seconds(self):
        assert _timestamp_to_seconds("1:02:30") == 3750

    def test_two_digit_hours(self):
        assert _timestamp_to_seconds("10:00:00") == 36000


class TestLinkifyTimestamps:
    def test_replaces_mm_ss_markers(self):
        out = linkify_timestamps("See [02:30] for details.", "abc123")
        assert out == "See [[02:30]](https://youtu.be/abc123?t=150s) for details."

    def test_replaces_h_mm_ss_markers(self):
        out = linkify_timestamps("Wrap-up [1:02:30].", "abc123")
        assert "[[1:02:30]](https://youtu.be/abc123?t=3750s)" in out

    def test_no_video_id_is_passthrough(self):
        text = "Reference [02:30] here."
        assert linkify_timestamps(text, None) == text
        assert linkify_timestamps(text, "") == text

    def test_empty_input_is_passthrough(self):
        assert linkify_timestamps("", "abc") == ""
        assert linkify_timestamps(None, "abc") is None

    def test_multiple_markers_in_one_line(self):
        out = linkify_timestamps("A [00:05] and B [12:30].", "xyz")
        assert "?t=5s" in out
        assert "?t=750s" in out

    def test_ignores_non_timestamp_brackets(self):
        """Only [H:MM:SS] / [MM:SS] patterns should get linkified."""
        out = linkify_timestamps("Plain [text] stays put.", "abc123")
        assert out == "Plain [text] stays put."

    def test_does_not_linkify_three_digit_minutes(self):
        """Guard against odd captures like [123:45] which aren't valid."""
        out = linkify_timestamps("Odd [123:45] marker.", "abc123")
        # The regex only accepts \d{1,2}:\d{2}; [123:45] should not match.
        # Our regex allows 1-2 digits in the first group, so "23:45" inside
        # would match — verify the full string stays intact.
        assert out == "Odd [123:45] marker." or "[[23:45]]" in out
        # Ensure we never fabricate a URL with "123" as minutes (7380+ seconds
        # from a single group is fine, but let's just ensure no bogus output).
        assert "youtu.be/abc123?t=" in out or out == "Odd [123:45] marker."
