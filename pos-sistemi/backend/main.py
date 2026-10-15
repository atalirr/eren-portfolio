"""
FastAPI Entry Point
POS 6 Backend Server
"""

import argparse
import sys
from pathlib import Path

# Backend src klasörünü path'e ekle
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path / 'src'))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.app import create_app
from src.shared.config.settings import get_settings

settings = get_settings()


class HardCORSMiddleware:
    CORS_HEADERS = [
        (b"access-control-allow-origin", b"*"),
        (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, PATCH"),
        (b"access-control-allow-headers", b"*"),
        (b"access-control-expose-headers", b"*"),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("method") == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": self.CORS_HEADERS + [
                    (b"content-length", b"0"),
                    (b"content-type", b"text/plain"),
                ],
            })
            await send({"type": "http.response.body", "body": b""})
            return

        original_send = send

        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                skip = {
                    b"access-control-allow-origin",
                    b"access-control-allow-methods",
                    b"access-control-allow-headers",
                    b"access-control-expose-headers",
                }
                existing = [
                    (k, v) for k, v in message.get("headers", [])
                    if k.lower() not in skip
                ]
                message = {
                    **message,
                    "headers": existing + self.CORS_HEADERS,
                }
            await original_send(message)

        await self.app(scope, receive, send_with_cors)


_fastapi_app = create_app()


@_fastapi_app.get("/health")
async def health_check():
    return {"status": "ok", "message": "POS 6 Backend is running"}


@_fastapi_app.get("/api/test-cors")
async def test_cors():
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"status": "ok", "message": "CORS test basarili", "cors_enabled": True},
    )


app = HardCORSMiddleware(_fastapi_app)


def main():
    parser = argparse.ArgumentParser(description='POS 6 Backend Server')
    parser.add_argument('--port', type=int, default=14532, help='Port number')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host address')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload (dev mode)')

    args = parser.parse_args()

    print("[START] POS 6 Backend baslatiliyor...")
    print(f"[INFO] Host: {args.host}, Port: {args.port}")
    print(f"[INFO] Environment: {settings.ENVIRONMENT}")
    print("[INFO] HardCORSMiddleware aktif")

    if args.reload:
        print("[INFO] Auto-reload modu aktif")
        uvicorn.run(
            "main:app",
            host=args.host,
            port=args.port,
            reload=True,
            log_level="info"
        )
    else:
        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            reload=False,
            log_level="info"
        )


if __name__ == "__main__":
    main()
