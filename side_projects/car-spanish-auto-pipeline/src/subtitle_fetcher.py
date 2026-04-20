from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class SubtitleFetchResult:
    ok: bool
    lines: list[dict]
    source: str | None
    error: str | None


def _parse_timestamp(ts: str) -> float:
    ts = ts.replace(",", ".").strip()
    parts = ts.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    if len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(ts)


def _parse_vtt_or_srt(path: Path) -> list[dict]:
    lines: list[dict] = []
    block: list[str] = []

    def flush_block(items: list[str]) -> None:
        if not items:
            return
        cue_lines = [x.strip("\ufeff") for x in items if x.strip()]
        if not cue_lines:
            return
        time_idx = None
        for i, ln in enumerate(cue_lines):
            if "-->" in ln:
                time_idx = i
                break
        if time_idx is None:
            return
        start_raw, end_raw = [x.strip() for x in cue_lines[time_idx].split("-->")[:2]]
        start = _parse_timestamp(start_raw.split()[0])
        end = _parse_timestamp(end_raw.split()[0])
        text = " ".join(cue_lines[time_idx + 1 :]).strip()
        if text:
            lines.append({"start": start, "end": end, "es": text, "zh": ""})

    for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if ln.strip() == "":
            flush_block(block)
            block = []
        else:
            block.append(ln)
    flush_block(block)
    return lines


def _parse_json3(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    events = data.get("events", [])
    out: list[dict] = []
    for ev in events:
        if "segs" not in ev:
            continue
        start = ev.get("tStartMs", 0) / 1000.0
        dur = ev.get("dDurationMs", 0) / 1000.0
        text = "".join(seg.get("utf8", "") for seg in ev.get("segs", [])).strip()
        if text:
            out.append({"start": start, "end": start + max(dur, 0.1), "es": text, "zh": ""})
    return out


def _collect_caption_files(tmp_dir: Path, base: str) -> Iterable[Path]:
    patterns = [f"{base}*.vtt", f"{base}*.srt", f"{base}*.json3"]
    for p in patterns:
        yield from tmp_dir.glob(p)


def fetch_subtitles(video_url: str, tmp_dir: Path, lang: str = "es") -> SubtitleFetchResult:
    if not shutil.which("yt-dlp"):
        return SubtitleFetchResult(False, [], None, "yt-dlp not found in PATH.")

    tmp_dir.mkdir(parents=True, exist_ok=True)
    base = "caps"

    attempts = [
        ["yt-dlp", "--skip-download", "--write-subs", "--sub-langs", f"{lang}.*", "--sub-format", "best", "-o", str(tmp_dir / base), video_url],
        ["yt-dlp", "--skip-download", "--write-auto-subs", "--sub-langs", f"{lang}.*", "--sub-format", "best", "-o", str(tmp_dir / base), video_url],
    ]

    last_err = "No subtitle files found."
    for idx, cmd in enumerate(attempts, start=1):
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            last_err = (proc.stderr or proc.stdout or "yt-dlp subtitle fetch failed").strip()
            continue
        files = sorted(_collect_caption_files(tmp_dir, base))
        if not files:
            continue
        for f in files:
            try:
                if f.suffix == ".json3":
                    parsed = _parse_json3(f)
                else:
                    parsed = _parse_vtt_or_srt(f)
                if parsed:
                    source = "manual" if idx == 1 else "auto"
                    return SubtitleFetchResult(True, parsed, source, None)
            except Exception as e:  # pragma: no cover
                last_err = f"Failed to parse subtitle file {f.name}: {e}"
    return SubtitleFetchResult(False, [], None, last_err)
