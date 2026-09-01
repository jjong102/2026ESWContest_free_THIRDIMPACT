#!/usr/bin/env python3
"""GDM floor plan / rooms / robot pose → HTTP for the React Move tab.

Serves local GDM floor_plan assets even when ROS is not running.
Robot pose is proxied from GDM web_server_node (default :8080) when available.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("GDM_BRIDGE_PORT", "5178"))
GDM_WEB = os.environ.get("GDM_WEB_URL", "http://127.0.0.1:8080").rstrip("/")

ROOT = Path(__file__).resolve().parents[1]
FLOOR_PLAN_DIR = Path(
    os.environ.get(
        "GDM_FLOOR_PLAN_DIR",
        ROOT / "GDM" / "GDM" / "floor_plan",
    )
)
MAPS_DIR = Path(os.environ.get("GDM_MAPS_DIR", ROOT / "GDM" / "maps"))


def find_map_basename() -> str | None:
    yaml_files = sorted(FLOOR_PLAN_DIR.glob("*.yaml"))
    if yaml_files:
        return yaml_files[0].stem
    yaml_files = sorted(MAPS_DIR.glob("*.yaml"))
    if yaml_files:
        return yaml_files[0].stem
    return None


def floorplan_png_path() -> Path | None:
    basename = find_map_basename()
    if not basename:
        return None
    candidate = FLOOR_PLAN_DIR / f"{basename}.png"
    if candidate.is_file():
        return candidate
    return None


def rooms_json_path(kind: str = "confirmed") -> Path | None:
    basename = find_map_basename()
    if not basename:
        return None
    suffix = "_rooms_confirmed.json" if kind == "confirmed" else "_rooms_draft.json"
    candidate = FLOOR_PLAN_DIR / f"{basename}{suffix}"
    if candidate.is_file():
        return candidate
    return None


def proxy_json(url: str) -> tuple[int, dict | list | None, str | None]:
    try:
        with urllib.request.urlopen(url, timeout=1.5) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body), None
    except urllib.error.HTTPError as exc:
        return exc.code, None, str(exc)
    except Exception as exc:  # noqa: BLE001
        return 0, None, str(exc)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        # pose/status는 0.5~5초 폴링이라 액세스 로그는 생략 (오류만 출력)
        message = fmt % args
        if " 200 " in message or message.endswith(" 200 -"):
            return
        print(f"[gdm-bridge] {self.address_string()} - {message}")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, obj, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str) -> None:
        data = path.read_bytes()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]

        if path in ("/api/gdm/health", "/api/gdm/status"):
            png = floorplan_png_path()
            rooms = rooms_json_path("confirmed")
            pose_status, pose, pose_err = proxy_json(f"{GDM_WEB}/api/robot/pose")
            self._send_json(
                {
                    "ok": True,
                    "floor_plan_dir": str(FLOOR_PLAN_DIR),
                    "map": find_map_basename(),
                    "has_floorplan": bool(png and png.is_file()),
                    "has_rooms": bool(rooms and rooms.is_file()),
                    "gdm_web": GDM_WEB,
                    "robot_pose_live": pose_status == 200 and bool(pose),
                    "robot_pose_error": pose_err,
                }
            )
            return

        if path == "/api/gdm/floorplan.png":
            png = floorplan_png_path()
            if not png:
                self.send_error(404, "floor plan png not found")
                return
            self._send_file(png, "image/png")
            return

        if path in ("/api/gdm/rooms", "/api/gdm/rooms/confirmed"):
            rooms_path = rooms_json_path("confirmed")
            if not rooms_path:
                self._send_json({"map": find_map_basename(), "rooms": [], "image_size": None})
                return
            data = json.loads(rooms_path.read_text(encoding="utf-8"))
            self._send_json(data)
            return

        if path == "/api/gdm/rooms/draft":
            rooms_path = rooms_json_path("draft")
            if not rooms_path:
                self._send_json({"map": find_map_basename(), "rooms": []})
                return
            self._send_json(json.loads(rooms_path.read_text(encoding="utf-8")))
            return

        if path == "/api/gdm/robot/pose":
            status, pose, err = proxy_json(f"{GDM_WEB}/api/robot/pose")
            if status == 200 and isinstance(pose, dict):
                self._send_json({**pose, "live": True, "source": "gdm_web"})
                return
            self._send_json(
                {
                    "live": False,
                    "source": "bridge",
                    "error": err or f"gdm web unreachable ({status})",
                }
            )
            return

        self.send_error(404, "not found")


def main() -> None:
    print(f"[gdm-bridge] http://127.0.0.1:{PORT} ← {FLOOR_PLAN_DIR}")
    print(f"[gdm-bridge] robot pose proxy ← {GDM_WEB}/api/robot/pose")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
