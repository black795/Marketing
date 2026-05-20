"""FastAPI worker that wraps /API/manager.py over HTTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `from API.manager import ...` work without touching /API itself.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from API.manager import available_models  # noqa: E402

from app.routes.generate_image import router as generate_image_router  # noqa: E402
from app.routes.generate_video import router as generate_video_router  # noqa: E402
from app.schemas import HealthResponse  # noqa: E402

app = FastAPI(title="Tim Koda — Image Worker", version="0.1.0")

GATEWAY_ORIGIN = os.getenv("GATEWAY_ORIGIN", "http://localhost:4000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[GATEWAY_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", models=available_models())


app.include_router(generate_image_router)
app.include_router(generate_video_router)
