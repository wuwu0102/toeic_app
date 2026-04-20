from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, json_path: Path, web_root: Path, **kwargs):
        self.json_path = json_path
        super().__init__(*args, directory=str(web_root), **kwargs)

    def do_GET(self):  # noqa: N802
        if urlparse(self.path).path == "/api/subtitles":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if self.json_path.exists():
                data = self.json_path.read_text(encoding="utf-8")
            else:
                data = json.dumps([], ensure_ascii=False)
            self.wfile.write(data.encode("utf-8"))
            return
        super().do_GET()


def serve_preview(json_path: Path, web_root: Path, host: str = "127.0.0.1", port: int = 8765) -> None:
    def handler(*args, **kwargs):
        return PreviewHandler(*args, json_path=json_path, web_root=web_root, **kwargs)

    server = ThreadingHTTPServer((host, port), handler)
    print(f"Preview server running at http://{host}:{port}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
