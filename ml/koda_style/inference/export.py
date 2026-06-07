"""
Export del modelo → `style_profile.json` consumible por el motor TS de
frontend/editing/.

El motor TS no corre Python. En vez de servir el modelo, exportamos una "tabla de
política": para cada contexto (role × emotion × prev_emotion) las opciones
preferidas con su score. El motor usa esa tabla para SESGAR sus funciones pick*
(pickTransitionIn, pickCaptionStyle, ...) hacia tu estilo aprendido — manteniendo
las reglas actuales como fallback cuando un contexto no está en la tabla.

Formato de salida:
{
  "version": 1,
  "heads": {
    "transition_in": {
      "kind": "classification",
      "policy": [
        {"context": {"role":"cta","emotion":"excited","prev_emotion":"neutral"},
         "ranked": [["zoom-in",0.71],["whip",0.18],["cut",0.06]]},
        ...
      ]
    },
    "final_duration_s": {"kind":"regression", "note":"usar modelo, no tabla"}
  }
}
"""
from __future__ import annotations

import json
from itertools import product
from pathlib import Path
from statistics import median

from ..models.multihead import StyleModel
from ..schema import Example, SceneFeatures, SceneLabels


def _pct(sorted_vals: list[float], q: float) -> float:
    """Percentil simple (nearest-rank) sobre una lista ya ordenada."""
    if not sorted_vals:
        return 0.0
    i = min(len(sorted_vals) - 1, max(0, round(q * (len(sorted_vals) - 1))))
    return sorted_vals[i]


def _duration_policy(examples: list[Example], head: str) -> dict:
    """Tabla de ritmo: duración típica (mediana + rango) global y por rol.

    Más robusta que una regresión lineal sobre pocos datos y directamente
    consumible: el motor TS sostiene cada clip ~`median` segundos según su rol.
    """
    by_role: dict[str, list[float]] = {}
    allv: list[float] = []
    for e in examples:
        v = getattr(e.labels, head)
        if v is None:
            continue
        v = float(v)
        allv.append(v)
        by_role.setdefault(e.features.role, []).append(v)

    def stats(vals: list[float]) -> dict:
        s = sorted(vals)
        return {
            "median": round(median(s), 3),
            "p25": round(_pct(s, 0.25), 3),
            "p75": round(_pct(s, 0.75), 3),
            "n": len(s),
        }

    return {
        "kind": "regression",
        "unit": "seconds",
        "overall": stats(allv) if allv else {"median": 0, "p25": 0, "p75": 0, "n": 0},
        "by_role": {r: stats(v) for r, v in sorted(by_role.items())},
    }


def _median_features(model: StyleModel) -> dict:
    """Valores numéricos/booleanos típicos para fijar el contexto al enumerar."""
    enc = model.encoder
    return {
        "duration_s": enc.mean.get("duration_s", 3.0),
        "audio_energy": enc.mean.get("audio_energy", 0.5),
        "motion": enc.mean.get("motion", 0.5),
        "has_face": True,
        "has_speech": True,
        "scene_index": int(enc.mean.get("scene_index", 1)),
        "scene_count": max(2, int(enc.mean.get("scene_count", 6))),
        "beat_near_cut": True,
    }


def export_style_profile(
    model: StyleModel,
    out_path: str | Path,
    cfg: dict,
    examples: list[Example] | None = None,
) -> Path:
    top_k = cfg.get("export", {}).get("top_k", 3)
    base = _median_features(model)

    roles = model.encoder.vocabs["role"].itos
    emotions = model.encoder.vocabs["emotion"].itos
    prev_emotions = model.encoder.vocabs["prev_emotion"].itos

    out = {"version": 1, "heads": {}}
    for head, kind in model.head_kinds.items():
        if head not in model.models:
            continue
        if kind == "regression":
            out["heads"][head] = (
                _duration_policy(examples, head)
                if examples
                else {"kind": "regression", "note": "predicción continua; servir el modelo"}
            )
            continue
        policy = []
        for role, emo, prev in product(roles, emotions, prev_emotions):
            if role == "<unk>" or emo == "<unk>":
                continue
            feats = SceneFeatures(
                **base,
                role=role,
                emotion=emo,
                prev_emotion=None if prev == "<unk>" else prev,
            )
            ex = Example("ctx", "ctx", feats, SceneLabels())
            ranked = model.rank(ex, head, top_k=top_k)
            policy.append({
                "context": {"role": role, "emotion": emo, "prev_emotion": prev},
                "ranked": [[name, round(score, 4)] for name, score in ranked],
            })
        out["heads"][head] = {"kind": "classification", "policy": policy}

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_path
