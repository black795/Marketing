"""POST /generate-video — wraps API.manager.run_model for HTTP access (Kling v3 family)."""
from __future__ import annotations

import base64
import logging
import mimetypes
import re
import tempfile
import traceback
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from API.manager import run_model

from app.schemas import GenerateVideoRequest, GenerateVideoResponse

logger = logging.getLogger("worker.generate_video")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s — %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

_STATUS_PATTERN = re.compile(r"status:\s*(\d{3})")

router = APIRouter()

# Wire (kebab-case) → registry name (snake_case)
MODEL_NAME_MAP: dict[str, str] = {
    "kling-v3-omni": "kling_v3_omni",
    "kling-v3": "kling_v3",
}

# Which kwarg each model accepts for reference images. kling_v3 has none.
REFERENCE_KW: dict[str, str] = {
    "kling_v3_omni": "reference_images",
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
                detail="image_url / reference URLs must be data: or http(s) URLs",
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

    target = Path(tempfile.gettempdir()) / f"tim-koda-vid-{uuid.uuid4().hex}.{ext}"
    target.write_bytes(raw)
    return target


def _extract_url(result: Any) -> str:
    if isinstance(result, dict):
        if "url" in result and isinstance(result["url"], str):
            return result["url"]
        if "urls" in result and isinstance(result["urls"], list) and result["urls"]:
            return result["urls"][0]
    raise RuntimeError(f"Unexpected run_model result shape: {result!r}")


def _identity_prefix(model_id: str, ref_count: int) -> str:
    if ref_count == 0:
        return ""
    if model_id == "kling_v3_omni":
        return (
            "IDENTITY LOCK: The reference images show the same real character. "
            "Keep face, hair, body, and clothing identical across the entire video. "
            "Scene description follows: "
        )
    return ""


@router.post("/generate-video", response_model=GenerateVideoResponse)
async def generate_video(payload: GenerateVideoRequest) -> GenerateVideoResponse:
    py_name = MODEL_NAME_MAP.get(payload.model)
    if not py_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{payload.model}'. "
            f"Known: {sorted(MODEL_NAME_MAP.keys())}",
        )

    ref_urls = list(payload.reference_image_urls or [])
    if ref_urls and py_name not in REFERENCE_KW:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{payload.model}' does not support reference_image_urls",
        )

    final_prompt = _identity_prefix(py_name, len(ref_urls)) + payload.prompt

    kwargs: dict[str, Any] = {
        "prompt": final_prompt,
        "aspect_ratio": payload.aspect_ratio,
        "duration": payload.duration,
        "resolution": payload.resolution,
        "sound": payload.sound,
    }

    temp_files: list[Path] = []
    try:
        if payload.image_url:
            try:
                start_path = await _materialize_reference(payload.image_url)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to prepare starting image: {exc}",
                ) from exc
            temp_files.append(start_path)
            kwargs["image_input"] = str(start_path)

        if ref_urls:
            ref_paths: list[Path] = []
            for url in ref_urls:
                try:
                    path = await _materialize_reference(url)
                except HTTPException:
                    raise
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to prepare reference image: {exc}",
                    ) from exc
                ref_paths.append(path)
            temp_files.extend(ref_paths)
            ref_kw = REFERENCE_KW[py_name]
            kwargs[ref_kw] = [str(p) for p in ref_paths]

        prompt_preview = final_prompt[:80].replace("\n", " ")
        logger.info(
            "→ run_model py_name=%s aspect=%s duration=%ds res=%s sound=%s start_img=%s refs=%d prompt=\"%s…\"",
            py_name,
            payload.aspect_ratio,
            payload.duration,
            payload.resolution,
            payload.sound,
            bool(payload.image_url),
            len(ref_urls),
            prompt_preview,
        )

        try:
            result = await run_in_threadpool(run_model, py_name, **kwargs)
        except Exception as exc:
            message = str(exc)
            status_match = _STATUS_PATTERN.search(message)
            upstream_status = int(status_match.group(1)) if status_match else None
            exc_type = type(exc).__name__

            if upstream_status in (429, 402):
                logger.warning(
                    "✗ Replicate %s (%s): %s",
                    upstream_status,
                    exc_type,
                    message,
                )
                raise HTTPException(
                    status_code=upstream_status,
                    detail=f"Replicate {upstream_status}: {message}",
                ) from exc

            logger.error(
                "✗ 502 Bad Gateway — model=%s exc_type=%s upstream_status=%s msg=%s",
                py_name,
                exc_type,
                upstream_status,
                message,
            )
            logger.error("Stack trace:\n%s", traceback.format_exc())

            raise HTTPException(
                status_code=502,
                detail=f"Replicate call failed [{exc_type}]: {message}",
            ) from exc

        video_url = _extract_url(result)
        model_id = result.get("model", py_name) if isinstance(result, dict) else py_name

        logger.info("✓ 200 model=%s url=%s…", model_id, video_url[:60])
        return GenerateVideoResponse(video_url=video_url, model=model_id)

    finally:
        for p in temp_files:
            if p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
