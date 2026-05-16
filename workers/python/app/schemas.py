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


class HealthResponse(BaseModel):
    status: str
    models: list[str]
