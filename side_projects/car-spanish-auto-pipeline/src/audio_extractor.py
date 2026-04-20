from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


class AudioExtractionError(RuntimeError):
    pass


def extract_audio(video_url: str, tmp_dir: Path) -> Path:
    if not shutil.which("yt-dlp"):
        raise AudioExtractionError("yt-dlp not found in PATH.")
    if not shutil.which("ffmpeg"):
        raise AudioExtractionError("ffmpeg not found in PATH.")

    tmp_dir.mkdir(parents=True, exist_ok=True)
    out_tmpl = tmp_dir / "audio.%(ext)s"
    cmd = [
        "yt-dlp",
        "-x",
        "--audio-format",
        "wav",
        "-o",
        str(out_tmpl),
        video_url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "audio extraction failed").strip()
        raise AudioExtractionError(f"Failed to extract audio: {msg}")

    wav = tmp_dir / "audio.wav"
    if not wav.exists():
        raise AudioExtractionError("Audio extraction did not produce audio.wav")
    return wav
