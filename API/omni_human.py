"""
bytedance/omni-human — Avatar realista desde imagen + audio.

A diferencia de p-video-avatar (que hace TTS interno desde texto), OmniHuman
requiere un ARCHIVO DE AUDIO: genera un humano digital realista a partir de
una sola imagen + ese audio. Mayor realismo (cuerpo, micro-movimiento, lipsync)
a cambio de no traer voz integrada.

Schema real (verificado vía openapi_schema de Replicate):
  - image  (uri, REQUERIDO) — imagen con un sujeto/cara/personaje.
  - audio  (uri, REQUERIDO) — audio (MP3/WAV) que la persona "dice".

Output: un MP4 (string uri).

Docs: https://replicate.com/bytedance/omni-human
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Optional, Union

import replicate
from dotenv import load_dotenv

from API.manager import register

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_ID = "bytedance/omni-human"

FileInput = Union[str, Path, IO[bytes]]


def _prepare_file(src: FileInput) -> IO[bytes]:
    """Normaliza una ruta/objeto a un file-like binario abierto."""
    if isinstance(src, (str, Path)):
        path = Path(src)
        if not path.is_file():
            raise FileNotFoundError(f"Archivo no encontrado: {path}")
        return open(path, "rb")
    return src


def _normalize_url(output: object) -> str:
    """El output de Replicate puede ser str, lista, o FileOutput con .url."""
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        url = first.url if hasattr(first, "url") else str(first)
        return url() if callable(url) else url
    if hasattr(output, "url"):
        raw = output.url
        return raw() if callable(raw) else raw
    return str(output)


def generate(
    *,
    image: FileInput,
    audio: FileInput,
    output_path: Union[str, Path, None] = None,
) -> dict:
    """
    Genera un video de avatar realista con bytedance/omni-human.

    Requiere imagen + audio (no hace TTS). Para el flujo texto→video usa
    p_video_avatar, o genera el audio en un paso TTS previo.

    Returns:
        dict con keys: "url", "model" y opcionalmente "output_path".
    """
    if not os.getenv("REPLICATE_API_TOKEN"):
        raise RuntimeError("REPLICATE_API_TOKEN no encontrado en .env")

    opened_files: list[IO[bytes]] = []
    try:
        img_file = _prepare_file(image)
        if hasattr(img_file, "close"):
            opened_files.append(img_file)

        audio_file = _prepare_file(audio)
        if hasattr(audio_file, "close"):
            opened_files.append(audio_file)

        input_params = {"image": img_file, "audio": audio_file}

        try:
            output = replicate.run(MODEL_ID, input=input_params)
        except Exception as e:
            raise RuntimeError(f"Replicate API error ({MODEL_ID}): {e}") from e

        url = _normalize_url(output)
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


register("omni_human")(generate)
