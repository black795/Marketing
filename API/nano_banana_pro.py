"""
google/nano-banana-pro — Google's state-of-the-art image generation and editing model.

Características:
  - Resolución default 2K (mejor que nano-banana-2 que es 1K)
  - Hasta 14 imágenes de referencia (image_input)
  - Commercial use, zero training, data privacy
  - Fallback opcional a bytedance/seedream-5 si está saturado

Docs: https://replicate.com/google/nano-banana-pro/api/schema
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Literal, Sequence, Union

import replicate
from dotenv import load_dotenv

from API.manager import register

# Cargar variables del .env en la raíz
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_ID = "google/nano-banana-pro"

Resolution = Literal["1K", "2K", "4K"]
AspectRatio = Literal[
    "match_input_image", "1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "3:2", "21:9"
]
OutputFormat = Literal["jpg", "png"]
SafetyLevel = Literal[
    "block_low_and_above", "block_medium_and_above", "block_only_high"
]

ImageInput = Union[str, Path, IO[bytes]]


def _prepare_image(img: ImageInput) -> IO[bytes]:
    """Normaliza una imagen a un file-like binario."""
    if isinstance(img, (str, Path)):
        path = Path(img)
        if not path.is_file():
            raise FileNotFoundError(f"Imagen de referencia no encontrada: {path}")
        return open(path, "rb")
    return img


def generate(
    prompt: str,
    *,
    image_input: Sequence[ImageInput] | None = None,
    resolution: Resolution = "2K",
    aspect_ratio: AspectRatio = "match_input_image",
    output_format: OutputFormat = "jpg",
    safety_filter_level: SafetyLevel = "block_only_high",
    allow_fallback_model: bool = False,
    output_path: str | Path | None = None,
) -> dict:
    """
    Genera una imagen con google/nano-banana-pro.

    Args:
        prompt: Descripción textual de la imagen.
        image_input: Lista opcional de imágenes (rutas o file-likes) hasta 14.
        resolution: "1K" | "2K" | "4K". Default 2K.
        aspect_ratio: Relación de aspecto. Default "match_input_image".
        output_format: "jpg" | "png". Default jpg.
        safety_filter_level: Nivel de filtro de contenido.
        allow_fallback_model: Si True, usa seedream-5 al saturarse.
        output_path: Si se entrega, descarga la imagen a esa ruta.

    Returns:
        dict con keys: "url", "output_path" (opcional), "model".
    """
    if not os.getenv("REPLICATE_API_TOKEN"):
        raise RuntimeError("REPLICATE_API_TOKEN no encontrado en .env")

    input_params: dict = {
        "prompt": prompt,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "output_format": output_format,
        "safety_filter_level": safety_filter_level,
        "allow_fallback_model": allow_fallback_model,
    }

    opened_files: list[IO[bytes]] = []
    try:
        if image_input:
            prepared = [_prepare_image(i) for i in image_input]
            opened_files = [f for f in prepared if hasattr(f, "close")]
            input_params["image_input"] = prepared

        try:
            output = replicate.run(MODEL_ID, input=input_params)
        except Exception as e:
            raise RuntimeError(f"Replicate API error ({MODEL_ID}): {e}") from e

        # Normalizar URL
        if isinstance(output, str):
            url = output
        elif isinstance(output, list) and output:
            first = output[0]
            url = first.url if hasattr(first, "url") else str(first)
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


# Registrar en el manager
register("nano_banana_pro")(generate)
