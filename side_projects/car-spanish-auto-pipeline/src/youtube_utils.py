from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")


def parse_youtube_input(input_str: str) -> dict:
    raw = (input_str or "").strip()
    if not raw:
        return {"ok": False, "video_id": None, "url": None, "error": "Input is empty."}

    if VIDEO_ID_PATTERN.match(raw):
        return {
            "ok": True,
            "video_id": raw,
            "url": f"https://www.youtube.com/watch?v={raw}",
            "error": None,
        }

    parsed = urlparse(raw)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        host = parsed.netloc.lower().replace("www.", "")
        if host in {"youtube.com", "m.youtube.com"} and parsed.path == "/watch":
            q = parse_qs(parsed.query)
            vid = (q.get("v") or [None])[0]
            if vid and VIDEO_ID_PATTERN.match(vid):
                return {
                    "ok": True,
                    "video_id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "error": None,
                }
            return {"ok": False, "video_id": None, "url": None, "error": "Invalid YouTube watch URL videoId."}

        if host == "youtu.be":
            vid = parsed.path.lstrip("/").split("/")[0]
            if vid and VIDEO_ID_PATTERN.match(vid):
                return {
                    "ok": True,
                    "video_id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "error": None,
                }
            return {"ok": False, "video_id": None, "url": None, "error": "Invalid youtu.be videoId."}

    return {
        "ok": False,
        "video_id": None,
        "url": None,
        "error": "Unsupported input. Use YouTube URL or 11-char videoId.",
    }
