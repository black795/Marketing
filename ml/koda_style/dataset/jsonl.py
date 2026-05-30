"""
Adaptador JSONL genérico — el destino más probable de TU dataset.

Espera un archivo .jsonl (un objeto JSON por línea) donde cada línea ya tiene la
forma canónica de `Example.to_json()`:

    {"project_id": "...", "scene_id": "...",
     "features": {...}, "labels": {...}}

Si tu dataset viene en otro formato, tienes dos caminos:
  (a) escribir un pequeño script que lo convierta a este .jsonl, o
  (b) crear un adaptador propio heredando de DatasetAdapter (ver base.py).

Este adaptador es tolerante: ignora campos desconocidos dentro de features/labels
metiéndolos en `extra`, así nunca rompe por un campo de más.
"""
from __future__ import annotations

import json
from typing import Iterator

from ..schema import Example, SceneFeatures, SceneLabels
from .base import DatasetAdapter

_FEATURE_FIELDS = set(SceneFeatures().__dict__.keys()) - {"extra"}
_LABEL_FIELDS = set(SceneLabels().__dict__.keys()) - {"extra"}


def _split_known(d: dict, known: set) -> tuple[dict, dict]:
    main = {k: v for k, v in d.items() if k in known}
    extra = {k: v for k, v in d.items() if k not in known and k != "extra"}
    extra.update(d.get("extra", {}))
    return main, extra


class JsonlAdapter(DatasetAdapter):
    name = "jsonl"

    def load(self) -> Iterator[Example]:
        if self.root is None or not self.root.exists():
            raise FileNotFoundError(
                f"JsonlAdapter necesita un archivo .jsonl existente; recibí: {self.root}"
            )
        with open(self.root, encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Línea {line_no} no es JSON válido: {e}") from e

                fmain, fextra = _split_known(raw.get("features", {}), _FEATURE_FIELDS)
                lmain, lextra = _split_known(raw.get("labels", {}), _LABEL_FIELDS)
                yield Example(
                    project_id=str(raw.get("project_id", f"proj-{line_no}")),
                    scene_id=str(raw.get("scene_id", f"s{line_no}")),
                    features=SceneFeatures(**fmain, extra=fextra),
                    labels=SceneLabels(**lmain, extra=lextra),
                )
