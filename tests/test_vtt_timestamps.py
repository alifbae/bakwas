"""Tests for clean_vtt_with_timestamps in src/subtitles.py."""

from src.subtitles import clean_vtt_with_timestamps


SAMPLE_VTT = """WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000
Welcome to the video

00:00:02.000 --> 00:00:05.000
We will cover three topics today

00:00:18.000 --> 00:00:21.000
First topic is testing

00:00:40.000 --> 00:00:43.000
Second topic is deployment
"""


class TestCleanVttWithTimestamps:
    def test_emits_bracketed_timestamps(self):
        out = clean_vtt_with_timestamps(SAMPLE_VTT)
        lines = out.split("\n")
        assert lines[0].startswith("[00:00]")
        # Third cue starts at 18s — with 15s downsample buckets it lands in
        # bucket #1 ([00:15..00:30)) and keeps its own start time in the label.
        assert any(line.startswith("[00:18]") for line in lines)
        # Fourth cue at 40s is a fresh bucket.
        assert any(line.startswith("[00:40]") for line in lines)

    def test_strips_headers_and_timing_arrows(self):
        out = clean_vtt_with_timestamps(SAMPLE_VTT)
        assert "WEBVTT" not in out
        assert "-->" not in out

    def test_downsample_merges_within_window(self):
        """Two cues inside the same 15-second bucket merge into one line."""
        out = clean_vtt_with_timestamps(SAMPLE_VTT, downsample_seconds=15)
        lines = out.split("\n")
        first_line = lines[0]
        # First two cues (0s + 2s) both fall in the [00:00] bucket.
        assert "Welcome to the video" in first_line
        assert "We will cover three topics today" in first_line

    def test_hour_formatting(self):
        vtt = (
            "WEBVTT\n\n"
            "01:02:30.000 --> 01:02:33.000\n"
            "An hour in\n"
        )
        out = clean_vtt_with_timestamps(vtt)
        assert out.startswith("[1:02:30]")

    def test_handles_empty_input(self):
        assert clean_vtt_with_timestamps("") == ""
        assert clean_vtt_with_timestamps("WEBVTT\n\n") == ""
