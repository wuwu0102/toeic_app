from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None

from .config import load_config
from .pipeline import PipelineOptions, run_pipeline
from .preview_server import serve_preview


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Spanish YouTube to subtitle JSON pipeline")
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--video-id", help="YouTube videoId")
    parser.add_argument("--out", required=True, help="Output JSON path")
    parser.add_argument("--prefer-subs", action="store_true", default=False, help="Prefer subtitles first")
    parser.add_argument("--force-transcribe", action="store_true", help="Skip subtitles and force transcribe")
    parser.add_argument("--translator", choices=["dummy", "openai"], default="dummy")
    parser.add_argument(
        "--model", choices=["tiny", "base", "small", "medium", "large-v3"], default="small"
    )
    parser.add_argument("--preview", action="store_true", help="Start local preview after output")
    parser.add_argument("--preview-port", type=int, default=8765)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    input_value = args.url or args.video_id
    if not input_value:
        parser.error("One of --url or --video-id is required.")

    if load_dotenv:
        load_dotenv()

    cfg = load_config()
    opts = PipelineOptions(
        input_value=input_value,
        out_path=Path(args.out),
        prefer_subs=True if args.prefer_subs else not args.force_transcribe,
        force_transcribe=args.force_transcribe,
        translator=args.translator,
        model=args.model,
        language="es",
        tmp_dir=cfg.tmp_dir,
    )

    result = run_pipeline(opts)
    for line in result.logs:
        print(f"[INFO] {line}")

    if not result.ok:
        print(f"[ERROR] {result.error}")
        return 1

    print(f"[OK] 完成：{result.output_path} (source={result.used_source})")

    if args.preview:
        web_root = cfg.project_root / "web_preview"
        serve_preview(Path(args.out), web_root, port=args.preview_port)

    return 0


if __name__ == "__main__":
    sys.exit(main())
