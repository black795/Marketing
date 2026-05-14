"""
Manager — Punto único de entrada para todos los modelos de Replicate configurados.

Uso:
    from API.manager import run_model
    result = run_model("nano_banana_2", prompt="...", image_input=[...])

Los modelos se auto-registran al ser importados aquí abajo.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv

# Cargar .env desde la raíz del proyecto
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

if not os.getenv("REPLICATE_API_TOKEN"):
    raise RuntimeError(
        "REPLICATE_API_TOKEN no encontrado. "
        "Configúralo en .env (raíz del proyecto)."
    )

# Registry: nombre lógico → función generadora
_REGISTRY: dict[str, Callable[..., Any]] = {}


def register(name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorador para registrar un modelo en el manager."""
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        _REGISTRY[name] = fn
        return fn
    return decorator


def run_model(name: str, **kwargs: Any) -> Any:
    """Ejecuta un modelo registrado por nombre."""
    if name not in _REGISTRY:
        raise KeyError(
            f"Modelo '{name}' no registrado. "
            f"Disponibles: {sorted(_REGISTRY.keys())}"
        )
    return _REGISTRY[name](**kwargs)


def available_models() -> list[str]:
    """Lista todos los modelos registrados."""
    return sorted(_REGISTRY.keys())


# ── Auto-imports de modelos registrados ───────────────────────────────────────
# Claude Code agregará aquí cada nuevo módulo automáticamente.
from API import nano_banana_pro  # noqa: F401, E402
from API import gpt_image_2  # noqa: F401, E402


if __name__ == "__main__":
    print("Modelos registrados:")
    for m in available_models():
        print(f"  - {m}")
