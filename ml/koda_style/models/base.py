"""
Contratos de modelo.

Un "head" (cabeza) = una decisión de edición a predecir: transición, estilo de
caption, animación, duración final... Cada head se entrena por separado pero
comparte el mismo vector de features.

`StyleModel` es la interfaz que cumplen todos los modelos (re-ranker hoy; XGBoost o
transformer mañana). Mientras respeten esta interfaz, training/export no cambian.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class HeadModel(ABC):
    """Modelo de UNA decisión."""

    kind: str = "abstract"   # "classification" | "regression"

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray) -> "HeadModel": ...

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Clase predicha (clasif.) o valor (regresión), shape (N,)."""

    def predict_proba(self, X: np.ndarray) -> np.ndarray | None:
        """Distribución sobre clases (clasif.), shape (N, K). None si no aplica."""
        return None

    @abstractmethod
    def to_json(self) -> dict: ...

    @staticmethod
    @abstractmethod
    def from_json(d: dict) -> "HeadModel": ...
