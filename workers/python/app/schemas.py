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
    reference_image_url: Optional[str] = Field(
        default=None,
        description="Optional reference image. Accepts http(s) URL or data: URL",
    )
    aspect_ratio: str = Field(
        default="9:16",
        description="Output aspect ratio. Default is vertical for Reels/TikTok",
    )


class GenerateImageResponse(BaseModel):
    image_url: str
    model: str


class HealthResponse(BaseModel):
    status: str
    models: list[str]
