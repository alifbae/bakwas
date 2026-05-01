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
                    metadata["captions"] = clean_vtt(response.text)
                    return metadata

        # Fallback to manual captions
        if "subtitles" in info and "en" in info["subtitles"]:
            captions = info["subtitles"]["en"]
            for caption in captions:
                if caption["ext"] == "vtt":
                    response = requests.get(caption["url"])
                    metadata["captions"] = clean_vtt(response.text)
                    return metadata

    return metadata


def clean_vtt(vtt_text):
    """Remove VTT formatting and timing tags, keep just text, and deduplicate"""
    lines = vtt_text.split("\n")
    text_lines = []
    seen_lines = set()

    for line in lines:
        line = line.strip()
        # Skip VTT headers, timestamps, empty lines, and note lines
        if (
            line
            and not line.startswith("WEBVTT")
            and not line.startswith("Kind:")
            and not line.startswith("Language:")
            and not line.startswith("NOTE")
            and not "-->" in line
            and not line.isdigit()
        ):

            # Remove timing tags like <00:00:00.480>
            line = re.sub(r"<[\d:.]+>", "", line)
            # Remove other XML-like tags
            line = re.sub(r"<[^>]+>", "", line)

            cleaned_line = line.strip()
            # Only add if not seen before (deduplication)
            if cleaned_line and cleaned_line not in seen_lines:
                text_lines.append(cleaned_line)
                seen_lines.add(cleaned_line)

    # Join and remove any repeated words that might span across lines
    full_text = " ".join(text_lines)

    # Remove consecutive duplicate words
    words = full_text.split()
    deduped_words = []
    prev_word = None

    for word in words:
        if word != prev_word:
            deduped_words.append(word)
            prev_word = word

    return " ".join(deduped_words)
