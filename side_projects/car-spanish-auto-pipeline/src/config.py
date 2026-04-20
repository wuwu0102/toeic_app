from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppConfig:
    project_root: Path
    output_dir: Path
    tmp_dir: Path
    default_model: str = "small"
    default_language: str = "es"


def load_config() -> AppConfig:
    project_root = Path(__file__).resolve().parents[1]
    output_dir = project_root / "output"
    tmp_dir = project_root / ".tmp"
    output_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    return AppConfig(
        project_root=project_root,
        output_dir=output_dir,
        tmp_dir=tmp_dir,
        default_model=os.getenv("WHISPER_MODEL", "small"),
        default_language=os.getenv("WHISPER_LANGUAGE", "es"),
    )
