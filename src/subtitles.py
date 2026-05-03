"""
Subtitle extraction and cleaning module.
Handles YouTube video info extraction and VTT caption cleaning.
"""

import re
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import requests
import yt_dlp


def validate_youtube_url(url):
    """Validate that URL is from YouTube domain"""
    try:
        parsed = urlparse(url)
        allowed_domains = [
            "youtube.com",
            "www.youtube.com",
            "youtu.be",
            "m.youtube.com",
        ]
        return parsed.netloc in allowed_domains
    except:
        return False


def extract_video_id(url):
    """
    Extract the canonical YouTube video ID from any supported URL form.
    Supports:
      - https://www.youtube.com/watch?v=<id>
      - https://youtu.be/<id>
      - https://m.youtube.com/watch?v=<id>
      - https://www.youtube.com/shorts/<id>
      - https://www.youtube.com/embed/<id>
    Returns None if no ID can be extracted.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    host = (parsed.netloc or "").lower()
    path = parsed.path or ""

    if host == "youtu.be":
        # youtu.be/<id>
        candidate = path.lstrip("/").split("/", 1)[0]
        return candidate or None

    if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        # watch?v=<id>
        if path == "/watch":
            qs = parse_qs(parsed.query or "")
            vals = qs.get("v")
            if vals:
                return vals[0] or None
        # /shorts/<id> or /embed/<id> or /live/<id>
        parts = [p for p in path.split("/") if p]
        if len(parts) >= 2 and parts[0] in {"shorts", "embed", "live"}:
            return parts[1] or None

    return None


def canonicalize_youtube_url(url):
    """
    Return a canonical YouTube URL suitable for caching/lookup.
    Falls back to the original URL if no video ID can be extracted.
    """
    video_id = extract_video_id(url)
    if not video_id:
        return url
    return f"https://www.youtube.com/watch?v={video_id}"


def get_video_info(url):
    """Extract video info and captions from YouTube URL"""
    # Validate URL is from YouTube
    if not validate_youtube_url(url):
        raise ValueError("Invalid URL: Only YouTube URLs are allowed")

    ydl_opts = {
        "writeautomaticsub": True,
        "skip_download": True,
        "subtitleslangs": ["en"],
        "quiet": False,
        "no_warnings": False,
        "extractor_args": {
            "youtube": {
                "player_client": ["ios", "android"],
                "player_skip": ["webpage", "configs"],
            }
        },
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        # Extract metadata
        metadata = {
            "title": info.get("title", "Unknown"),
            "creator": info.get("uploader", info.get("channel", "Unknown")),
            "video_date": info.get("upload_date", ""),  # Format: YYYYMMDD
            "duration_seconds": int(info["duration"]) if info.get("duration") else None,
            "captions": None,
        }

        # Format video date if available
        if metadata["video_date"]:
            try:
                date_obj = datetime.strptime(metadata["video_date"], "%Y%m%d")
                metadata["video_date"] = date_obj.strftime("%Y-%m-%d")
            except:
                pass

        # Get auto-generated captions
        if "automatic_captions" in info and "en" in info["automatic_captions"]:
            captions = info["automatic_captions"]["en"]
            for caption in captions:
                if caption["ext"] == "vtt":
                    response = requests.get(caption["url"])
                    metadata["captions"] = clean_vtt_with_timestamps(response.text)
                    return metadata

        # Fallback to manual captions
        if "subtitles" in info and "en" in info["subtitles"]:
            captions = info["subtitles"]["en"]
            for caption in captions:
                if caption["ext"] == "vtt":
                    response = requests.get(caption["url"])
                    metadata["captions"] = clean_vtt_with_timestamps(response.text)
                    return metadata

    return metadata


def _format_timestamp(seconds):
    """Format a second count as MM:SS or H:MM:SS, matching YouTube's `&t=` conventions."""
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _parse_vtt_timestamp(ts):
    """Parse an HH:MM:SS.mmm VTT timestamp into float seconds. Returns None on failure."""
    try:
        # VTT uses HH:MM:SS.mmm. Some files omit the hour.
        parts = ts.strip().split(":")
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        if len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
    except (ValueError, AttributeError):
        return None
    return None


def clean_vtt_with_timestamps(vtt_text, downsample_seconds=15):
    """
    Parse a VTT caption file into newline-separated `[MM:SS] text` cues.

    Downsamples so at most one cue per `downsample_seconds` window survives;
    cues inside the same window get merged into the first cue's line. This
    keeps the LLM input short while preserving navigation granularity good
    enough for "where was this talked about" clicks.

    Preserves dedup so auto-generated captions don't produce an endless
    stream of repeated words.

    Returns a string shaped like:
        [00:00] Welcome to the video
        [00:15] First we'll talk about X
        [02:30] Here's the second topic
    """
    lines = vtt_text.split("\n")
    cues = []  # list of (start_seconds, text)
    current_start = None
    current_text_parts = []

    def _flush_current():
        if current_start is None:
            return
        text = " ".join(current_text_parts).strip()
        text = re.sub(r"<[\d:.]+>", "", text)
        text = re.sub(r"<[^>]+>", "", text).strip()
        if text:
            cues.append((current_start, text))

    for line in lines:
        line = line.strip()
        if not line:
            _flush_current()
            current_start = None
            current_text_parts = []
            continue

        if (
            line.startswith("WEBVTT")
            or line.startswith("Kind:")
            or line.startswith("Language:")
            or line.startswith("NOTE")
            or line.isdigit()
        ):
            continue

        if "-->" in line:
            # Cue timing line: "HH:MM:SS.mmm --> HH:MM:SS.mmm ..."
            _flush_current()
            start_str = line.split("-->")[0].strip().split()[0]
            current_start = _parse_vtt_timestamp(start_str)
            current_text_parts = []
            continue

        if current_start is not None:
            current_text_parts.append(line)

    # Trailing cue without a blank line at EOF
    _flush_current()

    # Downsample: keep the first cue in each N-second window and merge any
    # subsequent cues' unique text into it, then dedupe consecutive words.
    bucketed = []
    seen_texts = set()
    last_bucket = None
    for start, text in cues:
        if text in seen_texts:
            continue
        seen_texts.add(text)
        bucket = int(start // downsample_seconds)
        if bucketed and bucket == last_bucket:
            bucketed[-1] = (bucketed[-1][0], bucketed[-1][1] + " " + text)
        else:
            bucketed.append((start, text))
            last_bucket = bucket

    formatted = []
    for start, text in bucketed:
        words = text.split()
        deduped = []
        prev = None
        for w in words:
            if w != prev:
                deduped.append(w)
                prev = w
        formatted.append(f"[{_format_timestamp(start)}] {' '.join(deduped)}")

    return "\n".join(formatted)
