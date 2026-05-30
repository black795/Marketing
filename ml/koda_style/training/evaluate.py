"""
Métricas de validación: ¿el modelo predice lo que TÚ habrías elegido?

  - Clasificación: top-1 accuracy y top-3 accuracy (¿tu elección está entre las 3
    sugerencias top?). Top-3 es lo relevante para un re-ranker que SUGIERE.
  - Regresión: MAE (error medio absoluto, en segundos).
"""
from __future__ import annotations

import numpy as np

from ..models.multihead import StyleModel
from ..schema import Example


def evaluate(model: StyleModel, examples: list[Example]) -> dict[str, dict]:
    if not examples:
        return {}
    X = model.encoder.transform([e.features for e in examples])
    report: dict[str, dict] = {}

    for head, kind in model.head_kinds.items():
        if head not in model.models:
            continue
        if kind == "classification":
            vocab = model.label_vocabs[head]
            y_true = np.array([vocab.encode(getattr(e.labels, head)) for e in examples])
            proba = model.models[head].predict_proba(X)
            top1 = proba.argmax(axis=1)
            top3 = np.argsort(proba, axis=1)[:, ::-1][:, :3]
            acc1 = float((top1 == y_true).mean())
            acc3 = float(np.mean([yt in row for yt, row in zip(y_true, top3)]))
            report[head] = {"kind": kind, "n": len(examples), "top1": round(acc1, 3), "top3": round(acc3, 3)}
        else:
            raw = [(model.predict_value(e, head), getattr(e.labels, head)) for e in examples]
            pairs = [(p, t) for p, t in raw if t is not None]
            if not pairs:
                continue
            mae = float(np.mean([abs(p - t) for p, t in pairs]))
            report[head] = {"kind": kind, "n": len(pairs), "mae": round(mae, 3)}
    return report


def format_report(report: dict[str, dict]) -> str:
    lines = []
    for head, m in report.items():
        if m["kind"] == "classification":
            lines.append(f"  {head:18} top1={m['top1']:.3f}  top3={m['top3']:.3f}  (n={m['n']})")
        else:
            lines.append(f"  {head:18} MAE={m['mae']:.3f}s  (n={m['n']})")
    return "\n".join(lines) if lines else "  (sin cabezas evaluables)"
