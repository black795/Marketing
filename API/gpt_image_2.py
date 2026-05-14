"""
openai/gpt-image-2 — OpenAI's state-of-the-art image generation and editing model.

Características:
  - Strong instruction following y sharp text rendering
  - Editing detallado con imágenes de entrada
  - Output array de hasta 10 imágenes por request
  - Background transparente / opaco / auto
  - Default output: webp

Docs: https://replicate.com/openai/gpt-image-2/api/schema
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Literal, Sequence, Union

import replicate
from dotenv import load_dotenv

from API.manager import register

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_ID = "openai/gpt-image-2"

Quality = Literal["auto", "low", "medium", "high"]
Background = Literal["auto", "transparent", "opaque"]
Moderation = Literal["auto", "low"]
AspectRatio = Literal["1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "3:2"]
OutputFormat = Literal["webp", "png", "jpeg"]

ImageInput = Union[str, Path, IO[bytes]]


def _prepare_image(img: ImageInput) -> IO[bytes]:
    if isinstance(img, (str, Path)):
        path = Path(img)
        if not path.is_file():
            raise FileNotFoundError(f"Imagen de referencia no encontrada: {path}")
        return open(path, "rb")
    return img


def _resolve_url(item) -> str:
    if isinstance(item, str):
        return item
    if hasattr(item, "url"):
        raw = item.url
        return raw() if callable(raw) else raw
    return str(item)


def generate(
    prompt: str,
    *,
    input_images: Sequence[ImageInput] | None = None,
    quality: Quality = "auto",
    aspect_ratio: AspectRatio = "1:1",
    background: Background = "auto",
    moderation: Moderation = "auto",
    number_of_images: int = 1,
    output_format: OutputFormat = "webp",
    output_compression: int = 90,
    user_id: str | None = None,
    openai_api_key: str | None = None,
    output_dir: str | Path | None = None,
    output_basename: str = "gpt_image_2",
) -> dict:
    """
    Genera imágenes con openai/gpt-image-2.

    Args:
        prompt: Descripción textual.
        input_images: Lista opcional de imágenes para editar / referenciar.
        quality: "auto" | "low" | "medium" | "high".
        aspect_ratio: Relación de aspecto.
        background: "auto" | "transparent" | "opaque".
        moderation: Nivel de moderación de contenido.
        number_of_images: 1-10 imágenes por request.
        output_format: "webp" | "png" | "jpeg".
        output_compression: 0-100 (calidad de compresión).
        user_id: ID opcional para tracking OpenAI.
        openai_api_key: Si se entrega, bypassa el proxy de Replicate.
        output_dir: Si se entrega, descarga cada imagen ahí.
        output_basename: Nombre base de los archivos descargados.

    Returns:
        dict con keys: "urls" (lista), "output_paths" (lista, opcional), "model".
    """
    if not os.getenv("REPLICATE_API_TOKEN"):
        raise RuntimeError("REPLICATE_API_TOKEN no encontrado en .env")
    if not 1 <= number_of_images <= 10:
        raise ValueError("number_of_images debe estar entre 1 y 10")
    if not 0 <= output_compression <= 100:
        raise ValueError("output_compression debe estar entre 0 y 100")

    input_params: dict = {
        "prompt": prompt,
        "quality": quality,
        "aspect_ratio": aspect_ratio,
        "background": background,
        "moderation": moderation,
        "number_of_images": number_of_images,
        "output_format": output_format,
        "output_compression": output_compression,
    }
    if user_id:
        input_params["user_id"] = user_id
    if openai_api_key:
        input_params["openai_api_key"] = openai_api_key

    opened_files: list[IO[bytes]] = []
    try:
        if input_images:
            prepared = [_prepare_image(i) for i in input_images]
            opened_files = [f for f in prepared if hasattr(f, "close")]
            input_params["input_images"] = prepared

        try:
            output = replicate.run(MODEL_ID, input=input_params)
        except Exception as e:
            raise RuntimeError(f"Replicate API error ({MODEL_ID}): {e}") from e

        # Output es uri[] (lista de URIs)
        if isinstance(output, list):
            items = output
        else:
            items = [output]

        urls = [_resolve_url(it) for it in items]
        result: dict = {"urls": urls, "model": MODEL_ID}

        if output_dir is not None:
            out_dir = Path(output_dir)
            out_dir.mkdir(parents=True, exist_ok=True)
            paths: list[str] = []
            for idx, (item, url) in enumerate(zip(items, urls), start=1):
                ext = output_format if output_format != "jpeg" else "jpg"
                fname = f"{output_basename}_{idx:02d}.{ext}" if len(items) > 1 else f"{output_basename}.{ext}"
                target = out_dir / fname
                if hasattr(item, "read"):
                    with open(target, "wb") as f:
                        f.write(item.read())
                else:
                    import urllib.request
                    urllib.request.urlretrieve(url, target)
                paths.append(str(target))
            result["output_paths"] = paths

        return result

    finally:
        for f in opened_files:
            try:
                f.close()
            except Exception:
                pass


register("gpt_image_2")(generate)
