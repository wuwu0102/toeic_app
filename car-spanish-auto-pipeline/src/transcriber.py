from __future__ import annotations

from pathlib import Path


class TranscriptionError(RuntimeError):
    pass


def transcribe_audio(audio_path: Path, model_name: str = "small", language: str = "es") -> list[dict]:
    if not audio_path.exists():
        raise TranscriptionError(f"Audio file not found: {audio_path}")

    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise TranscriptionError(
            "faster-whisper is not installed. Install requirements first."
        ) from e

    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as e:
        raise TranscriptionError(f"Failed to load Whisper model '{model_name}': {e}") from e

    try:
        segments, _ = model.transcribe(str(audio_path), language=language, vad_filter=True)
        out: list[dict] = []
        for seg in segments:
            text = (seg.text or "").strip()
            if text:
                out.append({"start": float(seg.start), "end": float(seg.end), "es": text, "zh": ""})
        if not out:
            raise TranscriptionError("Whisper returned no transcription segments.")
        return out
    except Exception as e:
        raise TranscriptionError(f"Whisper transcription failed: {e}") from e
