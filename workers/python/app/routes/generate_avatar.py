"""POST /generate-avatar — wraps API.manager.run_model para el modelo de avatar."""
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

from app.schemas import GenerateAvatarRequest, GenerateAvatarResponse

logger = logging.getLogger("worker.generate_avatar")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s — %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

_STATUS_PATTERN = re.compile(r"status:\s*(\d{3})")

# data: URL de imagen o audio (el avatar acepta ambos tipos de archivo).
_DATA_URL_PATTERN = re.compile(
    r"^data:(?P<mime>(?:image|audio)/[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$"
)

router = APIRouter()


def _ext_from_mime(mime: str) -> str:
    ext = mimetypes.guess_extension(mime) or ".bin"
    return ext.lstrip(".")


async def _materialize(url: str, kind: str) -> Path:
    """Convierte una data: URL o http(s) URL en un archivo temporal local.

    `kind` ("image" | "audio") solo se usa para el nombre del temp y mensajes.
    El caller es responsable de borrar el archivo.
    """
    match = _DATA_URL_PATTERN.match(url)
    if match:
        raw = base64.b64decode(match.group("data"))
        ext = _ext_from_mime(match.group("mime"))
    else:
        if not url.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=400,
                detail=f"{kind} debe ser una data: URL o una URL http(s)",
            )
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo descargar el {kind}: HTTP {resp.status_code}",
            )
        raw = resp.content
        content_type = (
            resp.headers.get("content-type", "application/octet-stream")
            .split(";")[0]
            .strip()
        )
        ext = _ext_from_mime(content_type)

    target = Path(tempfile.gettempdir()) / f"tim-koda-avatar-{kind}-{uuid.uuid4().hex}.{ext}"
    target.write_bytes(raw)
    return target


def _extract_url(result: Any) -> str:
    if isinstance(result, dict):
        if "url" in result and isinstance(result["url"], str):
            return result["url"]
        if "urls" in result and isinstance(result["urls"], list) and result["urls"]:
            return result["urls"][0]
    raise RuntimeError(f"Forma inesperada del resultado de run_model: {result!r}")


@router.post("/generate-avatar", response_model=GenerateAvatarResponse)
async def generate_avatar(payload: GenerateAvatarRequest) -> GenerateAvatarResponse:
    has_audio = bool(payload.audio)
    model = (payload.model or "p_video_avatar").strip()

    # OmniHuman es más realista pero NO hace TTS: requiere audio sí o sí.
    if model == "omni_human" and not has_audio:
        raise HTTPException(
            status_code=400,
            detail="El modelo realista (omni_human) requiere un archivo de audio; "
            "no genera voz desde texto. Sube un audio o usa p_video_avatar.",
        )

    if not has_audio and not payload.voice_script.strip():
        raise HTTPException(
            status_code=400,
            detail="Se requiere voice_script (texto a hablar) o audio (archivo).",
        )

    kwargs: dict[str, Any] = {
        "resolution": payload.resolution,
        "video_prompt": payload.video_prompt,
        "voice_script": payload.voice_script,
        "voice": payload.voice,
        "voice_prompt": payload.voice_prompt,
        "voice_language": payload.voice_language,
        "seed": payload.seed,
        "disable_safety_filter": payload.disable_safety_filter,
        "disable_prompt_upsampling": payload.disable_prompt_upsampling,
    }

    temp_files: list[Path] = []
    try:
        # --- Materializar la imagen del avatar (siempre requerida) ---
        try:
            image_path = await _materialize(payload.image, "image")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo preparar la imagen del avatar: {exc}",
            ) from exc
        temp_files.append(image_path)
        kwargs["image"] = str(image_path)

        # --- Materializar el audio (opcional) ---
        if has_audio:
            try:
                audio_path = await _materialize(payload.audio, "audio")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pudo preparar el audio: {exc}",
                ) from exc
            temp_files.append(audio_path)
            kwargs["audio"] = str(audio_path)

        # OmniHuman usa solo imagen + audio; p_video_avatar usa el set completo.
        if model == "omni_human":
            run_name = "omni_human"
            run_kwargs: dict[str, Any] = {
                "image": kwargs["image"],
                "audio": kwargs["audio"],
            }
        else:
            run_name = "p_video_avatar"
            run_kwargs = kwargs

        logger.info(
            "→ run_model %s resolution=%s mode=%s voice=%s lang=%s "
            'seed=%s video_prompt="%s…"',
            run_name,
            payload.resolution,
            "audio" if has_audio else "tts",
            payload.voice,
            payload.voice_language,
            payload.seed,
            payload.video_prompt[:60].replace("\n", " "),
        )

        try:
            result = await run_in_threadpool(run_model, run_name, **run_kwargs)
        except Exception as exc:
            message = str(exc)
            status_match = _STATUS_PATTERN.search(message)
            upstream_status = int(status_match.group(1)) if status_match else None
            exc_type = type(exc).__name__

            # 429 (throttled) / 402 (sin crédito) se propagan para retry inteligente.
            if upstream_status in (429, 402):
                logger.warning(
                    "✗ Replicate %s (%s): %s", upstream_status, exc_type, message
                )
                raise HTTPException(
                    status_code=upstream_status,
                    detail=f"Replicate {upstream_status}: {message}",
                ) from exc

            logger.error(
                "✗ 502 Bad Gateway — %s exc_type=%s upstream_status=%s msg=%s",
                run_name,
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
        model_id = result.get("model", "p_video_avatar") if isinstance(result, dict) else "p_video_avatar"

        logger.info("✓ 200 model=%s url=%s…", model_id, video_url[:60])
        return GenerateAvatarResponse(video_url=video_url, model=model_id)

    finally:
        for p in temp_files:
            if p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
