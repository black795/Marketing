"""
StyleModel — el modelo completo de TU estilo.

Junta:
  - el FeatureEncoder (mismo para todas las cabezas),
  - un HeadModel por cada decisión (transición, caption, animación, duración),
  - el Vocab de clases de cada cabeza de clasificación.

Es lo único que training instancia y lo único que inference/export carga. Cambiar
el tipo de modelo de una cabeza (softmax → XGBoost) se hace aquí, en `_make_head`,
sin tocar nada más.
"""
from __future__ import annotations

import numpy as np

from ..features.encoders import FeatureEncoder
from ..features.vocab import Vocab
from ..schema import Example
from .base import HeadModel
from .reranker import SoftmaxClassifier, LinearRegressor


class StyleModel:
    def __init__(self, heads: dict[str, str]):
        # heads: { "transition_in": "classification", "final_duration_s": "regression", ... }
        self.head_kinds = heads
        self.encoder = FeatureEncoder()
        self.models: dict[str, HeadModel] = {}
        self.label_vocabs: dict[str, Vocab] = {}  # solo para cabezas de clasificación

    @staticmethod
    def _make_head(kind: str) -> HeadModel:
        if kind == "classification":
            return SoftmaxClassifier()
        if kind == "regression":
            return LinearRegressor()
        raise ValueError(f"Tipo de cabeza desconocido: {kind}")

    def fit(self, examples: list[Example]) -> "StyleModel":
        self.encoder.fit([e.features for e in examples])
        X = self.encoder.transform([e.features for e in examples])

        for head, kind in self.head_kinds.items():
            ys_raw = [getattr(e.labels, head) for e in examples]
            if kind == "classification":
                vocab = Vocab(name=head)
                for y in ys_raw:
                    vocab.add(y)  # None -> '<unk>'
                self.label_vocabs[head] = vocab
                y = np.array([vocab.encode(v) for v in ys_raw])
                self.models[head] = SoftmaxClassifier(n_classes=len(vocab)).fit(X, y)
            else:  # regression — ignora ejemplos sin label
                mask = np.array([v is not None for v in ys_raw])
                if mask.sum() == 0:
                    continue
                y = np.array([float(v) for v in ys_raw if v is not None])
                self.models[head] = LinearRegressor().fit(X[mask], y)
        return self

    def rank(self, example: Example, head: str, top_k: int = 3) -> list[tuple[str, float]]:
        """Devuelve las opciones más probables para una cabeza de clasificación."""
        if self.head_kinds.get(head) != "classification":
            raise ValueError(f"rank() sólo aplica a clasificación, no a '{head}'.")
        x = self.encoder.transform_one(example.features)[None, :]
        proba = self.models[head].predict_proba(x)[0]
        vocab = self.label_vocabs[head]
        order = np.argsort(proba)[::-1][:top_k]
        return [(vocab.decode(int(i)), float(proba[i])) for i in order]

    def predict_value(self, example: Example, head: str) -> float:
        x = self.encoder.transform_one(example.features)[None, :]
        return float(self.models[head].predict(x)[0])

    def to_json(self) -> dict:
        return {
            "head_kinds": self.head_kinds,
            "encoder": self.encoder.to_json(),
            "models": {h: m.to_json() for h, m in self.models.items()},
            "label_vocabs": {h: v.to_json() for h, v in self.label_vocabs.items()},
        }

    @staticmethod
    def from_json(d: dict) -> "StyleModel":
        sm = StyleModel(d["head_kinds"])
        sm.encoder = FeatureEncoder.from_json(d["encoder"])
        sm.label_vocabs = {h: Vocab.from_json(v) for h, v in d["label_vocabs"].items()}
        for h, md in d["models"].items():
            sm.models[h] = (
                SoftmaxClassifier.from_json(md)
                if md["kind"] == "classification"
                else LinearRegressor.from_json(md)
            )
        return sm
