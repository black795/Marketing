"""
Modelos base — Fase 2 del plan: re-ranking aprendido en numpy puro (sin libs
pesadas, corre en cualquier máquina, incl. Python 3.14).

  - SoftmaxClassifier : regresión logística multinomial (clasificación).
  - LinearRegressor   : regresión lineal (p.ej. duración final).

Ambos entrenan con descenso de gradiente + regularización L2. Son interpretables
y aprenden bien con poca data — justo lo que necesitas al arrancar. Cuando tengas
miles de ejemplos, se sustituyen por XGBoost/transformer SIN tocar el resto
(cumplen la interfaz HeadModel).

`predict_proba` del clasificador da la distribución sobre opciones → es lo que se
exporta como "preferencias" para sesgar el motor TS.
"""
from __future__ import annotations

import numpy as np

from .base import HeadModel


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


class SoftmaxClassifier(HeadModel):
    kind = "classification"

    def __init__(self, n_classes: int = 0, lr: float = 0.5, l2: float = 1e-3, epochs: int = 400):
        self.n_classes = n_classes
        self.lr = lr
        self.l2 = l2
        self.epochs = epochs
        self.W: np.ndarray | None = None
        self.b: np.ndarray | None = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> "SoftmaxClassifier":
        n, d = X.shape
        k = self.n_classes or int(y.max()) + 1
        self.n_classes = k
        self.W = np.zeros((d, k))
        self.b = np.zeros(k)
        Y = np.eye(k)[y]  # one-hot targets
        for _ in range(self.epochs):
            probs = _softmax(X @ self.W + self.b)
            grad = probs - Y
            self.W -= self.lr * (X.T @ grad / n + self.l2 * self.W)
            self.b -= self.lr * grad.mean(axis=0)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return _softmax(X @ self.W + self.b)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def to_json(self) -> dict:
        return {
            "kind": self.kind,
            "n_classes": self.n_classes,
            "W": self.W.tolist(),
            "b": self.b.tolist(),
        }

    @staticmethod
    def from_json(d: dict) -> "SoftmaxClassifier":
        m = SoftmaxClassifier(n_classes=d["n_classes"])
        m.W = np.array(d["W"])
        m.b = np.array(d["b"])
        return m


class LinearRegressor(HeadModel):
    kind = "regression"

    def __init__(self, lr: float = 0.1, l2: float = 1e-3, epochs: int = 600):
        self.lr = lr
        self.l2 = l2
        self.epochs = epochs
        self.w: np.ndarray | None = None
        self.b: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "LinearRegressor":
        n, d = X.shape
        self.w = np.zeros(d)
        self.b = 0.0
        for _ in range(self.epochs):
            pred = X @ self.w + self.b
            err = pred - y
            self.w -= self.lr * (X.T @ err / n + self.l2 * self.w)
            self.b -= self.lr * err.mean()
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return X @ self.w + self.b

    def to_json(self) -> dict:
        return {"kind": self.kind, "w": self.w.tolist(), "b": float(self.b)}

    @staticmethod
    def from_json(d: dict) -> "LinearRegressor":
        m = LinearRegressor()
        m.w = np.array(d["w"])
        m.b = float(d["b"])
        return m
