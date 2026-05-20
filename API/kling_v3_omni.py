"""
kwaivgi/kling-v3-omni-video — Kling v3 Omni video generation model.

Características:
  - Image-to-video con frame inicial (image_input)
  - Soporte de hasta 7 reference_images para mantener identidad de personaje
  - Output: video 9:16 / 16:9 / 1:1, con audio opcional
  - Duración configurable (default 5s)

Schema real de Replicate (los nombres de la API difieren de los de la firma):
  - `mode`: "standard" (720p) | "pro" (1080p)  ← mapeado desde `resolution`
  - `generate_audio`: bool                      ← mapeado desde `sound`
  - `start_image`: imagen de frame inicial       ← mapeado desde `image_input`
  - `reference_images`: refs de identidad
  - `duration`, `aspect_ratio`, `prompt`: directos

Docs: https://replicate.com/kwaivgi/kling-v3-omni-video
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Literal, Sequence, Union

import replicate
from dotenv import load_dotenv

from API.manager import register

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_ID = "kwaivgi/kling-v3-omni-video"

AspectRatio = Literal["9:16", "16:9", "1:1"]
Resolution = Literal["720p", "1080p"]

# La API de Replicate usa `mode`, no `resolution`.
_MODE_BY_RESOLUTION = {"720p": "standard", "1080p": "pro"}

ImageInput = Union[str, Path, IO[bytes]]


def _prepare_image(img: ImageInput) -> IO[bytes]:
    """Normaliza una imagen a un file-like binario."""
    if isinstance(img, (str, Path)):
        path = Path(img)
        if not path.is_file():
            raise FileNotFoundError(f"Imagen no encontrada: {path}")
        return open(path, "rb")
    return img


def generate(
    prompt: str,
    *,
    image_input: ImageInput | None = None,
    reference_images: Sequence[ImageInput] | None = None,
    aspect_ratio: AspectRatio = "9:16",
    duration: int = 5,
    resolution: Resolution = "1080p",
    sound: bool = True,
    output_path: str | Path | None = None,
) -> dict:
    """
    Genera un video con kwaivgi/kling-v3-omni-video.

    Args:
        prompt: Descripción textual del video.
        image_input: Imagen opcional (path | file-like | URL) usada como frame inicial.
        reference_images: Hasta 7 imágenes de referencia para identidad de personaje.
        aspect_ratio: "9:16" | "16:9" | "1:1". Default "9:16".
        duration: Duración en segundos. Default 5.
        resolution: "720p" | "1080p". Default "1080p".
        sound: Generar audio. Default True.
        output_path: Si se entrega, descarga el video a esa ruta.

    Returns:
        dict con keys: "url", "output_path" (opcional), "model".
    """
    if not os.getenv("REPLICATE_API_TOKEN"):
        raise RuntimeError("REPLICATE_API_TOKEN no encontrado en .env")

    input_params: dict = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "duration": duration,
        "mode": _MODE_BY_RESOLUTION.get(resolution, "pro"),
        "generate_audio": sound,
    }

    opened_files: list[IO[bytes]] = []
    try:
        if image_input is not None:
            prepared_img = _prepare_image(image_input)
            if hasattr(prepared_img, "close"):
                opened_files.append(prepared_img)
            input_params["start_image"] = prepared_img

        if reference_images:
            prepared_refs = [_prepare_image(i) for i in reference_images]
            opened_files.extend(f for f in prepared_refs if hasattr(f, "close"))
            input_params["reference_images"] = prepared_refs

        try:
            output = replicate.run(MODEL_ID, input=input_params)
        except Exception as e:
            raise RuntimeError(f"Replicate API error ({MODEL_ID}): {e}") from e

        # Normalizar URL (video suele ser string o FileOutput con .url)
        if isinstance(output, str):
            url = output
        elif isinstance(output, list) and output:
            first = output[0]
            url = first.url if hasattr(first, "url") else str(first)
            if callable(url):
                url = url()
        elif hasattr(output, "url"):
            raw = output.url
            url = raw() if callable(raw) else raw
        else:
            url = str(output)

        result: dict = {"url": url, "model": MODEL_ID}

        if output_path is not None:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            if hasattr(output, "read"):
                with open(out, "wb") as f:
                    f.write(output.read())
            else:
                import urllib.request
                urllib.request.urlretrieve(url, out)
            result["output_path"] = str(out)

        return result

    finally:
        for f in opened_files:
            try:
                f.close()
            except Exception:
                pass


register("kling_v3_omni")(generate)
