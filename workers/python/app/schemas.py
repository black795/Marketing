"""Pydantic models for the Python worker."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class GenerateImageRequest(BaseModel):
    model: str = Field(
        ...,
        description="Logical model name as exposed to the frontend (kebab-case)",
    )
    prompt: str
    reference_image_urls: list[str] = Field(
        default_factory=list,
        description="Character reference images (data: or http(s) URLs). "
        "Sent to the model as image_input / input_images for identity preservation.",
    )
    # Legacy: una sola ref. Si llega, se promociona a la lista.
    reference_image_url: Optional[str] = Field(
        default=None,
        description="DEPRECATED. Use reference_image_urls. Singular legacy field.",
    )
    aspect_ratio: str = Field(
        default="9:16",
        description="Output aspect ratio. Default is vertical for Reels/TikTok",
    )
    quality: str = Field(
        default="standard",
        description='Quality profile: "draft" | "standard" | "high" | "ultra". '
        "Mapped per-model to native Replicate params.",
    )


class GenerateImageResponse(BaseModel):
    image_url: str
    model: str


class GenerateVideoRequest(BaseModel):
    model: str = Field(..., description="Logical model: kling-v3-omni | kling-v3")
    prompt: str
    image_url: Optional[str] = Field(
        default=None,
        description="Starting image for image-to-video (data: or http URL).",
    )
    reference_image_urls: list[str] = Field(
        default_factory=list,
        description="Identity references (sólo kling-v3-omni, máx 7).",
    )
    aspect_ratio: str = Field(default="9:16")
    duration: int = Field(default=5, ge=3, le=15)
    resolution: str = Field(default="1080p")
    sound: bool = Field(default=True)


class GenerateVideoResponse(BaseModel):
    video_url: str
    model: str


class GenerateAvatarRequest(BaseModel):
    """Request del modelo de avatar/lipsync (prunaai/p-video-avatar)."""

    image: str = Field(
        ...,
        description="Retrato del avatar (data: URL o http URL). jpg/png/webp.",
    )
    resolution: str = Field(default="720p", description='"720p" | "1080p"')
    audio: Optional[str] = Field(
        default=None,
        description="Audio propio (data: URL o http URL). Si se entrega, "
        "manda sobre voice_script y los ajustes de voz.",
    )
    voice_script: str = Field(
        default="",
        description="Palabras exactas que dirá el avatar. Requerido si no hay audio.",
    )
    voice: str = Field(default="Zephyr (Female)", description="Voz TTS.")
    voice_prompt: str = Field(
        default="Say the following.",
        description="Estilo de habla (tono, ritmo, emoción). No se pronuncia.",
    )
    voice_language: str = Field(
        default="English (US)", description="Idioma/acento de la voz."
    )
    video_prompt: str = Field(
        default="The person is talking.",
        description="Cómo se ve/comporta la persona mientras habla.",
    )
    seed: Optional[int] = Field(
        default=None, description="Semilla para reproducibilidad."
    )
    disable_safety_filter: bool = Field(default=True)
    disable_prompt_upsampling: bool = Field(default=False)


class GenerateAvatarResponse(BaseModel):
    video_url: str
    model: str


class HealthResponse(BaseModel):
    status: str
    models: list[str]
