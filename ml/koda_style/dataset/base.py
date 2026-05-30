"""
Adaptadores de dataset.

Un `DatasetAdapter` es el ÚNICO punto que conoce el formato crudo de tus datos.
Su trabajo: leer lo que sea (carpeta de proyectos CapCut, un .jsonl propio, una
base de datos...) y producir `Example` canónicos.

Cuando llegue TU dataset, lo único que escribes es una subclase de esto que
implemente `load()`. El resto del programa (features, modelos, training, export)
no cambia ni una línea.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterator

from ..schema import Example


class DatasetAdapter(ABC):
    """Convierte un dataset crudo en un stream de `Example` canónicos."""

    name: str = "abstract"

    def __init__(self, root: str | Path | None = None, **options):
        self.root = Path(root) if root is not None else None
        self.options = options

    @abstractmethod
    def load(self) -> Iterator[Example]:
        """Produce los ejemplos uno a uno (lazy: no carga todo en memoria)."""
        raise NotImplementedError

    def load_all(self) -> list[Example]:
        return list(self.load())
