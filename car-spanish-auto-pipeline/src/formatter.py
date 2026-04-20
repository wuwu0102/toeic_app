from __future__ import annotations

import json
import re
from pathlib import Path

SFX_PATTERN = re.compile(r"^(\[[^\]]+\]|\([^\)]+\))$")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def clean_lines(lines: list[dict], short_merge_threshold: float = 0.9) -> list[dict]:
    cleaned: list[dict] = []
    for item in lines:
        es = _normalize_text(item.get("es", ""))
        if not es:
            continue
        if SFX_PATTERN.match(es):
            continue

        start = float(item.get("start", 0.0))
        end = float(item.get("end", start))
        if end < start:
            end = start

        if cleaned:
            prev = cleaned[-1]
            same_text = prev["es"].lower() == es.lower()
            if same_text:
                prev["end"] = max(prev["end"], end)
                continue

            duration = max(end - start, 0)
            prev_gap = start - prev["end"]
            if duration <= short_merge_threshold and prev_gap <= 0.3:
                prev["es"] = f"{prev['es']} {es}".strip()
                prev["end"] = end
                continue

        cleaned.append(
            {
                "start": round(start, 3),
                "end": round(end, 3),
                "es": es,
                "zh": item.get("zh", ""),
            }
        )
    return cleaned


def to_pretty_json(lines: list[dict]) -> str:
    return json.dumps(lines, ensure_ascii=False, indent=2)


def to_compact_json(lines: list[dict]) -> str:
    return json.dumps(lines, ensure_ascii=False, separators=(",", ":"))


def write_json(lines: list[dict], out_path: Path, pretty: bool = True) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = to_pretty_json(lines) if pretty else to_compact_json(lines)
    out_path.write_text(payload + ("\n" if pretty else ""), encoding="utf-8")
