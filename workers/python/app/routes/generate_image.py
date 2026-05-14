"""POST /generate-image — wraps API.manager.run_model for HTTP access."""
from __future__ import annotations

import base64
import mimetypes
import re
import tempfile
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from API.manager import run_model

from app.schemas import GenerateImageRequest, GenerateImageResponse

router = APIRouter()

# Maps the kebab-case names used on the wire (frontend → backend → worker)
# to the snake_case names registered in API/manager.py
MODEL_NAME_MAP: dict[str, str] = {
    "nano-banana-pro": "nano_banana_pro",
    "chatgpt-image-2": "gpt_image_2",
}

NOT_YET_IMPLEMENTED = {"nano-banana-2"}

# Which kwarg each registered model accepts for reference images.
# nano_banana_pro uses "image_input", gpt_image_2 uses "input_images".
REFERENCE_KW: dict[str, str] = {
    "nano_banana_pro": "image_input",
    "gpt_image_2": "input_images",
}

DATA_URL_PATTERN = re.compile(r"^data:(?P<mime>image/[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$")


def _ext_from_mime(mime: str) -> str:
    ext = mimetypes.guess_extension(mime) or ".bin"
    return ext.lstrip(".")


async def _materialize_reference(url: str) -> Path:
    """Turn a data: or http(s) URL into a local temp file. Caller owns cleanup."""
    match = DATA_URL_PATTERN.match(url)
    if match:
        raw = base64.b64decode(match.group("data"))
        ext = _ext_from_mime(match.group("mime"))
    else:
        if not url.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=400,
                detail="reference_image_url must be a data: or http(s) URL",
            )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download reference image: HTTP {resp.status_code}",
            )
        raw = resp.content
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        ext = _ext_from_mime(content_type)

    target = Path(tempfile.gettempdir()) / f"tim-koda-ref-{uuid.uuid4().hex}.{ext}"
    target.write_bytes(raw)
    return target


def _extract_url(result: Any) -> str:
    if isinstance(result, dict):
        if "url" in result and isinstance(result["url"], str):
            return result["url"]
        if "urls" in result and isinstance(result["urls"], list) and result["urls"]:
            return result["urls"][0]
    raise RuntimeError(f"Unexpected run_model result shape: {result!r}")


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    if payload.model in NOT_YET_IMPLEMENTED:
        raise HTTPException(
            status_code=501,
            detail=f"Model '{payload.model}' is not yet wired up in /API",
        )

    py_name = MODEL_NAME_MAP.get(payload.model)
    if not py_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{payload.model}'. "
            f"Known: {sorted(MODEL_NAME_MAP.keys())}",
        )

    kwargs: dict[str, Any] = {
        "prompt": payload.prompt,
        "aspect_ratio": payload.aspect_ratio,
    }

    temp_ref: Path | None = None
    try:
        if payload.reference_image_url:
            temp_ref = await _materialize_reference(payload.reference_image_url)
            ref_kw = REFERENCE_KW[py_name]
            kwargs[ref_kw] = [str(temp_ref)]

        try:
            result = await run_in_threadpool(run_model, py_name, **kwargs)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Replicate call failed: {exc}",
            ) from exc

        image_url = _extract_url(result)
        model_id = result.get("model", py_name) if isinstance(result, dict) else py_name

        return GenerateImageResponse(image_url=image_url, model=model_id)

    finally:
        if temp_ref and temp_ref.exists():
            try:
                temp_ref.unlink()
            except OSError:
                pass
