"""
Codificador de features: convierte `SceneFeatures` (legible) en un vector numérico
(lo que come el modelo).

Estrategia:
  - Numéricas → estandarizadas (media 0, desviación 1), calculadas del train set.
  - Booleanas → 0/1.
  - Categóricas (role, emotion, prev_emotion) → one-hot usando un Vocab aprendido.

El `FeatureEncoder` se "ajusta" (fit) una vez sobre el train set y luego transforma
cualquier escena de forma idéntica (clave para que train e inferencia coincidan).
Es serializable a JSON → el export para el motor TS reusa exactamente estos params.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..schema import SceneFeatures
from .vocab import Vocab

# Orden fijo de las features numéricas y booleanas. NO reordenar (rompería modelos
# ya entrenados). Para añadir una, agrégala al final.
_NUMERIC = ["duration_s", "audio_energy", "motion", "scene_index", "scene_count", "position"]
_BOOL = ["has_face", "has_speech", "beat_near_cut"]
_CATEGORICAL = ["role", "emotion", "prev_emotion"]


@dataclass
class FeatureEncoder:
    vocabs: dict[str, Vocab] = field(default_factory=dict)
    mean: dict[str, float] = field(default_factory=dict)
    std: dict[str, float] = field(default_factory=dict)
    fitted: bool = False

    def fit(self, features: list[SceneFeatures]) -> "FeatureEncoder":
        # estadísticas de las numéricas
        for n in _NUMERIC:
            vals = np.array([self._num(f, n) for f in features], dtype=float)
            self.mean[n] = float(vals.mean()) if len(vals) else 0.0
            s = float(vals.std()) if len(vals) else 1.0
            self.std[n] = s if s > 1e-8 else 1.0
        # vocabularios categóricos
        for c in _CATEGORICAL:
            v = Vocab(name=c)
            for f in features:
                v.add(getattr(f, c))
            self.vocabs[c] = v
        self.fitted = True
        return self

    @staticmethod
    def _num(f: SceneFeatures, name: str) -> float:
        return float(f.position if name == "position" else getattr(f, name))

    def transform_one(self, f: SceneFeatures) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("FeatureEncoder no ajustado: llama a fit() primero.")
        parts: list[float] = []
        for n in _NUMERIC:
            parts.append((self._num(f, n) - self.mean[n]) / self.std[n])
        for b in _BOOL:
            parts.append(1.0 if getattr(f, b) else 0.0)
        for c in _CATEGORICAL:
            vocab = self.vocabs[c]
            onehot = [0.0] * len(vocab)
            onehot[vocab.encode(getattr(f, c))] = 1.0
            parts.extend(onehot)
        return np.array(parts, dtype=float)

    def transform(self, features: list[SceneFeatures]) -> np.ndarray:
        return np.vstack([self.transform_one(f) for f in features]) if features else np.zeros((0, self.dim))

    @property
    def dim(self) -> int:
        return len(_NUMERIC) + len(_BOOL) + sum(len(v) for v in self.vocabs.values())

    @property
    def feature_names(self) -> list[str]:
        names = list(_NUMERIC) + list(_BOOL)
        for c in _CATEGORICAL:
            names.extend(f"{c}={t}" for t in self.vocabs[c].itos)
        return names

    def to_json(self) -> dict:
        return {
            "numeric": _NUMERIC,
            "bool": _BOOL,
            "categorical": _CATEGORICAL,
            "mean": self.mean,
            "std": self.std,
            "vocabs": {k: v.to_json() for k, v in self.vocabs.items()},
        }

    @staticmethod
    def from_json(d: dict) -> "FeatureEncoder":
        enc = FeatureEncoder()
        enc.mean = dict(d["mean"])
        enc.std = dict(d["std"])
        enc.vocabs = {k: Vocab.from_json(v) for k, v in d["vocabs"].items()}
        enc.fitted = True
        return enc
