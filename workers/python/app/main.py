"""FastAPI worker that wraps /API/manager.py over HTTP."""
from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from pathlib import Path

# Make `from API.manager import ...` work without touching /API itself.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from API.manager import available_models  # noqa: E402

from app.routes.generate_image import router as generate_image_router  # noqa: E402
from app.routes.generate_video import router as generate_video_router  # noqa: E402
from app.schemas import HealthResponse  # noqa: E402

# ---------------------------------------------------------------------------
# Configuración de logging del worker.
#
# Nivel configurable vía WORKER_LOG_LEVEL (DEBUG | INFO | WARNING | ERROR).
# basicConfig deja un formato uniforme con timestamp + nivel + logger, de modo
# que stdout/stderr del worker quedan legibles y fáciles de filtrar.
# ---------------------------------------------------------------------------
_LOG_LEVEL = os.getenv("WORKER_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger("worker")

app = FastAPI(title="Tim Koda — Image Worker", version="0.1.0")

GATEWAY_ORIGIN = os.getenv("GATEWAY_ORIGIN", "http://localhost:4000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[GATEWAY_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Loguea cada request entrante/saliente con un id de correlación.

    Reusa el X-Request-Id que manda el gateway si está presente, así un
    error se puede rastrear de punta a punta: frontend → gateway → worker.
    Las excepciones no controladas se registran con stack trace completo
    y se devuelven como 500 en JSON (en vez de romper la conexión sin más).
    """
    req_id = request.headers.get("x-request-id") or f"w_{uuid.uuid4().hex[:8]}"
    started = time.perf_counter()
    logger.info("→ %s %s [req=%s]", request.method, request.url.path, req_id)

    try:
        response = await call_next(request)
    except Exception:  # noqa: BLE001 — queremos capturar TODO para loguearlo
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.exception(
            "✗ %s %s [req=%s] excepción no controlada tras %.0fms",
            request.method,
            request.url.path,
            req_id,
            elapsed_ms,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal worker error", "request_id": req_id},
            headers={"X-Request-Id": req_id},
        )

    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "← %s %s %d [req=%s] %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        req_id,
        elapsed_ms,
    )
    response.headers["X-Request-Id"] = req_id
    return response


@app.on_event("startup")
def _on_startup() -> None:
    logger.info(
        "worker iniciado — log_level=%s gateway_origin=%s models=%s",
        _LOG_LEVEL,
        GATEWAY_ORIGIN,
        available_models(),
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", models=available_models())


app.include_router(generate_image_router)
app.include_router(generate_video_router)
