from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .audio_extractor import AudioExtractionError, extract_audio
from .formatter import clean_lines, write_json
from .subtitle_fetcher import fetch_subtitles
from .transcriber import TranscriptionError, transcribe_audio
from .translator import TranslationError, build_translator
from .youtube_utils import parse_youtube_input


@dataclass
class PipelineOptions:
    input_value: str
    out_path: Path
    prefer_subs: bool = True
    force_transcribe: bool = False
    translator: str = "dummy"
    model: str = "small"
    language: str = "es"
    tmp_dir: Path = Path(".tmp")


@dataclass
class PipelineResult:
    ok: bool
    output_path: Path | None
    used_source: str | None
    logs: list[str]
    error: str | None = None


def run_pipeline(options: PipelineOptions) -> PipelineResult:
    logs: list[str] = []
    parsed = parse_youtube_input(options.input_value)
    logs.append("解析 YouTube 輸入...")
    if not parsed["ok"]:
        return PipelineResult(False, None, None, logs, f"Invalid input: {parsed['error']}")

    video_url = parsed["url"]
    logs.append(f"影片 ID: {parsed['video_id']}")

    lines: list[dict] = []
    used_source = None

    if options.prefer_subs and not options.force_transcribe:
        logs.append("嘗試取得字幕（人工字幕優先，自動字幕次之）...")
        subs = fetch_subtitles(video_url, options.tmp_dir, lang=options.language)
        if subs.ok:
            lines = subs.lines
            used_source = f"subtitles:{subs.source}"
            logs.append(f"已取得字幕，來源: {subs.source}")
        else:
            logs.append(f"字幕取得失敗：{subs.error}")

    if not lines:
        logs.append("改走音訊抽取 + Whisper 語音辨識...")
        try:
            audio_path = extract_audio(video_url, options.tmp_dir)
            logs.append(f"音訊完成：{audio_path}")
        except AudioExtractionError as e:
            return PipelineResult(False, None, used_source, logs, str(e))

        try:
            lines = transcribe_audio(audio_path, model_name=options.model, language=options.language)
            used_source = "transcription"
            logs.append(f"Whisper 辨識完成，共 {len(lines)} 段")
        except TranscriptionError as e:
            return PipelineResult(False, None, used_source, logs, str(e))

    logs.append("清理字幕資料...")
    lines = clean_lines(lines)

    logs.append(f"翻譯中（{options.translator}）...")
    try:
        translator = build_translator(options.translator)
        lines = translator.translate_lines(lines)
        logs.append("翻譯完成")
    except TranslationError as e:
        return PipelineResult(False, None, used_source, logs, str(e))

    logs.append(f"輸出 JSON：{options.out_path}")
    try:
        write_json(lines, options.out_path, pretty=True)
    except Exception as e:
        return PipelineResult(False, None, used_source, logs, f"Failed to write JSON: {e}")

    logs.append("JSON 輸出完成")
    return PipelineResult(True, options.out_path, used_source, logs, None)
