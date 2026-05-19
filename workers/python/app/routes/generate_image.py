"""POST /generate-image — wraps API.manager.run_model for HTTP access."""
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

from app.schemas import GenerateImageRequest, GenerateImageResponse

logger = logging.getLogger("worker.generate_image")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s — %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

# Patrón para detectar status HTTP embebido en mensajes de error de Replicate
# Ejemplo: "ReplicateError Details: status: 429 detail: Request was throttled..."
_STATUS_PATTERN = re.compile(r"status:\s*(\d{3})")

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

# ── Mapeo de calidad por modelo ────────────────────────────────────────────────
# Cada modelo expone parámetros nativos distintos. El frontend manda un
# perfil unificado ("draft" / "standard" / "high" / "ultra") y aquí
# se traduce a los kwargs reales que entiende cada wrapper en /API.

QUALITY_PROFILES = ("draft", "standard", "high", "ultra")

NANO_BANANA_QUALITY_MAP: dict[str, dict[str, Any]] = {
    "draft": {"resolution": "1K", "output_format": "jpg"},
    "standard": {"resolution": "2K", "output_format": "jpg"},
    "high": {"resolution": "2K", "output_format": "png"},
    "ultra": {"resolution": "4K", "output_format": "png"},
}

GPT_IMAGE_QUALITY_MAP: dict[str, dict[str, Any]] = {
    "draft": {"quality": "low", "output_compression": 75, "output_format": "webp"},
    "standard": {"quality": "medium", "output_compression": 85, "output_format": "webp"},
    "high": {"quality": "high", "output_compression": 92, "output_format": "png"},
    "ultra": {"quality": "high", "output_compression": 100, "output_format": "png"},
}

# gpt-image-2 no soporta 4:5 ni match_input_image. Mapeamos al más cercano.
GPT_IMAGE_ASPECT_FALLBACK: dict[str, str] = {
    "4:5": "3:4",
    "match_input_image": "1:1",
}


def _resolve_quality_kwargs(py_name: str, quality: str) -> dict[str, Any]:
    """Traduce un perfil de calidad a kwargs nativos del modelo."""
    if quality not in QUALITY_PROFILES:
        quality = "standard"
    if py_name == "nano_banana_pro":
        return dict(NANO_BANANA_QUALITY_MAP[quality])
    if py_name == "gpt_image_2":
        return dict(GPT_IMAGE_QUALITY_MAP[quality])
    return {}


def _resolve_aspect_ratio(py_name: str, aspect_ratio: str) -> str:
    """Algunos modelos no soportan todos los aspect ratios. Mapeamos al más cercano."""
    if py_name == "gpt_image_2":
        return GPT_IMAGE_ASPECT_FALLBACK.get(aspect_ratio, aspect_ratio)
    return aspect_ratio

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


def _consolidate_reference_urls(payload: GenerateImageRequest) -> list[str]:
    """Junta el campo plural y el legacy singular en una sola lista, sin duplicados."""
    urls: list[str] = []
    seen: set[str] = set()
    for u in list(payload.reference_image_urls or []):
        if isinstance(u, str) and u and u not in seen:
            seen.add(u)
            urls.append(u)
    if payload.reference_image_url and payload.reference_image_url not in seen:
        urls.append(payload.reference_image_url)
    return urls


def _identity_prefix(model_id: str, ref_count: int) -> str:
    """Refuerzo de identidad: instruye al modelo a tratar las refs como identidad canónica."""
    if ref_count == 0:
        return ""
    if model_id == "nano_banana_pro":
        return (
            "IDENTITY LOCK: The provided reference images show the SAME real character. "
            "Match facial structure, eyes, hair, skin tone, body type, and distinctive "
            "features EXACTLY across every output. Do not invent a different person; "
            "do not blend with stock looks. Preserve identity above style. "
            "Scene description follows: "
        )
    if model_id == "gpt_image_2":
        return (
            "Use the provided input_images as the canonical identity of the main "
            "character. Preserve face, hair, eyes, build, and identifiable features "
            "exactly. The text below describes the scene around that character: "
        )
    return ""


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

    aspect_ratio = _resolve_aspect_ratio(py_name, payload.aspect_ratio)
    quality_kwargs = _resolve_quality_kwargs(py_name, payload.quality)
    ref_urls = _consolidate_reference_urls(payload)

    final_prompt = _identity_prefix(py_name, len(ref_urls)) + payload.prompt

    kwargs: dict[str, Any] = {
        "prompt": final_prompt,
        "aspect_ratio": aspect_ratio,
        **quality_kwargs,
    }

    temp_refs: list[Path] = []
    try:
        if ref_urls:
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
                temp_refs.append(path)
            ref_kw = REFERENCE_KW[py_name]
            kwargs[ref_kw] = [str(p) for p in temp_refs]

        prompt_preview = final_prompt[:80].replace("\n", " ")
        logger.info(
            "→ run_model py_name=%s aspect=%s refs=%d quality_kw=%s prompt=\"%s…\"",
            py_name,
            aspect_ratio,
            len(temp_refs),
            quality_kwargs,
            prompt_preview,
        )

        try:
            result = await run_in_threadpool(run_model, py_name, **kwargs)
        except Exception as exc:
            message = str(exc)
            status_match = _STATUS_PATTERN.search(message)
            upstream_status = int(status_match.group(1)) if status_match else None
            exc_type = type(exc).__name__

            # Propagar 429 (throttled) y 402 (out of credit) tal cual
            # para que el gateway pueda reintentar de forma inteligente.
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

            # 502: error inesperado upstream. Logueamos stack completo para
            # poder distinguir entre E005 sensitive, schema mismatch, timeout,
            # rate limit no parseable, etc.
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

        image_url = _extract_url(result)
        model_id = result.get("model", py_name) if isinstance(result, dict) else py_name

        logger.info("✓ 200 model=%s url=%s…", model_id, image_url[:60])
        return GenerateImageResponse(image_url=image_url, model=model_id)

    finally:
        for p in temp_refs:
            if p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
