"""
prunaai/p-video-avatar — Avatar / lipsync video model.

Genera un video de avatar tipo "talking head": una imagen de retrato cobra
vida hablando, ya sea desde un guion de texto (voice_script + voz TTS) o
desde un archivo de audio propio.

Schema real de Replicate (verificado contra la API):
  - image            (uri, REQUERIDO) — retrato/primer frame. jpg/png/webp.
  - resolution       ("720p" | "1080p")
  - audio            (uri, opcional)  — si se entrega, manda sobre voice_*.
  - voice            (enum 30 voces)  — voz TTS para voice_script.
  - voice_script     (texto)          — palabras exactas que dice el avatar.
  - voice_prompt     (texto)          — estilo de habla (tono/ritmo/emoción).
  - voice_language   (enum 10 idiomas)
  - video_prompt     (texto)          — cómo se ve/comporta la persona.
  - seed             (int, opcional)  — reproducibilidad.
  - disable_safety_filter      (bool)
  - disable_prompt_upsampling  (bool)

Output: un MP4 (string uri).

Docs: https://replicate.com/prunaai/p-video-avatar
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Literal, Optional, Union

import replicate
from dotenv import load_dotenv

from API.manager import register

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_ID = "prunaai/p-video-avatar"

Resolution = Literal["720p", "1080p"]
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
    resolution: Resolution = "720p",
    audio: Optional[FileInput] = None,
    voice_script: str = "",
    voice: str = "Zephyr (Female)",
    voice_prompt: str = "Say the following.",
    voice_language: str = "English (US)",
    video_prompt: str = "The person is talking.",
    seed: Optional[int] = None,
    disable_safety_filter: bool = True,
    disable_prompt_upsampling: bool = False,
    output_path: Union[str, Path, None] = None,
) -> dict:
    """
    Genera un video de avatar con prunaai/p-video-avatar.

    El avatar habla desde `audio` (si se entrega) o desde `voice_script`
    sintetizado con la voz/idioma indicados.

    Returns:
        dict con keys: "url", "model" y opcionalmente "output_path".
    """
    if not os.getenv("REPLICATE_API_TOKEN"):
        raise RuntimeError("REPLICATE_API_TOKEN no encontrado en .env")

    if audio is None and not voice_script.strip():
        raise ValueError(
            "Se requiere 'voice_script' (texto a hablar) o 'audio' (archivo)."
        )

    input_params: dict = {
        "resolution": resolution,
        "video_prompt": video_prompt,
        "disable_safety_filter": disable_safety_filter,
        "disable_prompt_upsampling": disable_prompt_upsampling,
    }
    if seed is not None:
        input_params["seed"] = seed

    opened_files: list[IO[bytes]] = []
    try:
        img_file = _prepare_file(image)
        if hasattr(img_file, "close"):
            opened_files.append(img_file)
        input_params["image"] = img_file

        if audio is not None:
            # El audio propio manda: la API ignora voice_* cuando hay audio.
            audio_file = _prepare_file(audio)
            if hasattr(audio_file, "close"):
                opened_files.append(audio_file)
            input_params["audio"] = audio_file
        else:
            input_params["voice_script"] = voice_script
            input_params["voice"] = voice
            input_params["voice_prompt"] = voice_prompt
            input_params["voice_language"] = voice_language

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


register("p_video_avatar")(generate)
