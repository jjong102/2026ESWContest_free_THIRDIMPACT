#!/usr/bin/env python3
"""마이크 오디오 → 텍스트 STT HTTP 브리지 (faster-whisper)."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("STT_BRIDGE_PORT", "5177"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "auto")
WHISPER_COMPUTE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
STT_LANGUAGE = os.environ.get("STT_LANGUAGE", "ko")

_whisper_model = None
_whisper_error: str | None = None
_whisper_lock = threading.Lock()


def load_whisper_model():
    global _whisper_model, _whisper_error

    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model

        try:
            from faster_whisper import WhisperModel  # type: ignore

            device = WHISPER_DEVICE
            if device == "auto":
                device = "cuda" if _has_cuda() else "cpu"

            _whisper_model = WhisperModel(
                WHISPER_MODEL,
                device=device,
                compute_type=WHISPER_COMPUTE,
            )
            _whisper_error = None
            print(
                f"[stt-bridge] Whisper 로드: {WHISPER_MODEL} ({device}/{WHISPER_COMPUTE})",
                file=sys.stderr,
            )
            return _whisper_model
        except Exception as exc:  # noqa: BLE001
            _whisper_error = str(exc)
            print(f"[stt-bridge] Whisper 로드 실패: {exc}", file=sys.stderr)
            return None


def _has_cuda() -> bool:
    try:
        import torch  # type: ignore

        return torch.cuda.is_available()
    except Exception:
        return False


def audio_suffix(data: bytes) -> str:
    if data.startswith(b"RIFF"):
        return ".wav"
    if data.startswith(b"OggS"):
        return ".ogg"
    if data[:4] == b"\x1aE\xdf\xa3":
        return ".webm"
    if data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return ".mp3"
    return ".webm"


def transcribe_whisper(audio_bytes: bytes) -> dict:
    model = load_whisper_model()
    if model is None:
        raise RuntimeError(_whisper_error or "Whisper 모델 로드 실패")

    suffix = audio_suffix(audio_bytes)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()

        segments, _info = model.transcribe(
            tmp.name,
            language=STT_LANGUAGE,
            beam_size=1,
            vad_filter=False,
            condition_on_previous_text=False,
            no_speech_threshold=0.4,
        )
        text = "".join(segment.text for segment in segments).strip()

    if not text:
        print("[stt-bridge] 음성이 비어 있음", file=sys.stderr)
        raise RuntimeError("no-speech")

    print(f"[stt-bridge] ← whisper: {text}", file=sys.stderr)
    return {
        "text": text,
        "source": "whisper",
        "model": WHISPER_MODEL,
    }


class SttBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/api/stt/health":
            self._send_json(404, {"ok": False})
            return

        self._send_json(
            200,
            {
                "ok": True,
                "ready": _whisper_model is not None,
                "engine": "faster-whisper",
                "whisperModel": WHISPER_MODEL,
                "whisperDevice": WHISPER_DEVICE,
                "language": STT_LANGUAGE,
                "whisperError": _whisper_error,
            },
        )

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/stt/transcribe":
            self._send_json(404, {"ok": False})
            return

        length = int(self.headers.get("Content-Length", "0"))
        audio_bytes = self.rfile.read(length) if length else b""

        if len(audio_bytes) < 800:
            self._send_json(400, {"ok": False, "error": "no-speech"})
            return

        try:
            result = transcribe_whisper(audio_bytes)
            self._send_json(200, {"ok": True, **result})
        except Exception as exc:  # noqa: BLE001
            print(f"[stt-bridge] {exc}", file=sys.stderr)
            message = str(exc)
            status = 400 if "no-speech" in message else 500
            self._send_json(status, {"ok": False, "error": message})


def main() -> None:
    threading.Thread(target=load_whisper_model, name="whisper-load", daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), SttBridgeHandler)
    print(
        f"[stt-bridge] http://127.0.0.1:{PORT} (whisper={WHISPER_MODEL})",
        file=sys.stderr,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
