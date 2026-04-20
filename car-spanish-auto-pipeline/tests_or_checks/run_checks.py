from __future__ import annotations

from pathlib import Path

from src.formatter import clean_lines, to_compact_json, to_pretty_json
from src.pipeline import PipelineOptions, run_pipeline
from src.translator import DummyTranslator
from src.youtube_utils import parse_youtube_input


def check_parse_youtube_input() -> None:
    cases = {
        "dQw4w9WgXcQ": True,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ": True,
        "https://youtu.be/dQw4w9WgXcQ": True,
        "invalid_input": False,
    }
    for raw, expected in cases.items():
        got = parse_youtube_input(raw)["ok"]
        assert got == expected, f"parse_youtube_input failed: {raw}"


def check_formatter() -> None:
    lines = [
        {"start": 0.0, "end": 0.2, "es": "Hola", "zh": ""},
        {"start": 0.21, "end": 0.6, "es": "mundo", "zh": ""},
        {"start": 0.8, "end": 1.2, "es": "(applause)", "zh": ""},
    ]
    cleaned = clean_lines(lines)
    assert len(cleaned) == 1
    assert "Hola mundo" in cleaned[0]["es"]
    assert to_pretty_json(cleaned).startswith("[")
    assert to_compact_json(cleaned).startswith("[")


def check_dummy_translator() -> None:
    tr = DummyTranslator()
    out = tr.translate_lines([{"start": 0, "end": 1, "es": "Hola", "zh": ""}])
    assert out[0]["zh"], "Dummy translator should fill zh"


def check_pipeline_dry_run() -> None:
    out_path = Path("car-spanish-auto-pipeline/output/dryrun.json")
    opts = PipelineOptions(
        input_value="bad",
        out_path=out_path,
        prefer_subs=True,
        translator="dummy",
    )
    result = run_pipeline(opts)
    assert not result.ok
    assert "Invalid input" in (result.error or "")


if __name__ == "__main__":
    check_parse_youtube_input()
    check_formatter()
    check_dummy_translator()
    check_pipeline_dry_run()
    print("All checks passed.")
