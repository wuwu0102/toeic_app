from __future__ import annotations

import json
from pathlib import Path

from src.formatter import clean_lines, to_compact_json, to_pretty_json
from src.pipeline import PipelineOptions, run_pipeline
from src.translator import DummyTranslator
from src.youtube_utils import parse_youtube_input

PROJECT_ROOT = Path(__file__).resolve().parents[1]


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
    out_path = PROJECT_ROOT / "output/dryrun.json"
    opts = PipelineOptions(
        input_value="bad",
        out_path=out_path,
        prefer_subs=True,
        translator="dummy",
    )
    result = run_pipeline(opts)
    assert not result.ok
    assert "Invalid input" in (result.error or "")


def check_output_json_schema() -> None:
    output_path = PROJECT_ROOT / "output/result.json"
    data = json.loads(output_path.read_text(encoding="utf-8"))
    assert isinstance(data, list) and data, "output/result.json must be a non-empty list"
    for idx, item in enumerate(data):
        assert isinstance(item, dict), f"row {idx} is not an object"
        for key in ("start", "end", "es", "zh"):
            assert key in item, f"row {idx} missing key: {key}"
        assert isinstance(item["start"], (int, float))
        assert isinstance(item["end"], (int, float))
        assert item["end"] > item["start"]
        assert isinstance(item["es"], str) and item["es"].strip()
        assert isinstance(item["zh"], str)


def check_web_player_load_rules() -> None:
    app_js_path = PROJECT_ROOT / "web_player/app.js"
    text = app_js_path.read_text(encoding="utf-8")
    assert "../output/result.json" in text
    assert "./test_data/sample_result.json" in text
    assert "playing (output result)" in text
    assert "playing (fallback sample)" in text
    for token in ["start_time", "end_time", "translation", "item?.es ?? item?.text"]:
        assert token in text, f"normalizeData fallback token missing: {token}"


def check_required_files() -> None:
    required = [
        PROJECT_ROOT / "src/__init__.py",
        PROJECT_ROOT / "src/config.py",
        PROJECT_ROOT / "src/youtube_utils.py",
        PROJECT_ROOT / "src/subtitle_fetcher.py",
        PROJECT_ROOT / "src/audio_extractor.py",
        PROJECT_ROOT / "src/transcriber.py",
        PROJECT_ROOT / "src/translator.py",
        PROJECT_ROOT / "src/formatter.py",
        PROJECT_ROOT / "src/pipeline.py",
        PROJECT_ROOT / "src/cli.py",
        PROJECT_ROOT / "output/result.json",
        PROJECT_ROOT / "web_player/index.html",
        PROJECT_ROOT / "web_player/app.js",
        PROJECT_ROOT / "web_player/styles.css",
        PROJECT_ROOT / "web_player/test_data/sample_result.json",
        PROJECT_ROOT / "README.md",
        PROJECT_ROOT / "requirements.txt",
        PROJECT_ROOT / ".env.example",
    ]
    for path in required:
        assert path.exists(), f"required file missing: {path}"


if __name__ == "__main__":
    check_parse_youtube_input()
    check_formatter()
    check_dummy_translator()
    check_pipeline_dry_run()
    check_output_json_schema()
    check_web_player_load_rules()
    check_required_files()
    print("All checks passed.")
