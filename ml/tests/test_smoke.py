"""
Test de humo: corre la tubería completa sobre datos sintéticos.

    cd ml
    python -m pytest tests/         # si tienes pytest
    python tests/test_smoke.py      # o directo, sin pytest

Verifica que:
  1. el adaptador produce ejemplos,
  2. el modelo entrena y APRENDE (top1 sintético por encima del azar),
  3. el round-trip to_json/from_json conserva las predicciones,
  4. el export genera un style_profile.json bien formado.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koda_style.dataset.registry import get_adapter
from koda_style.models.multihead import StyleModel
from koda_style.training.evaluate import evaluate
from koda_style.inference.export import export_style_profile
from koda_style.config import DEFAULT


def _examples(n=80):
    return get_adapter("synthetic", n_projects=n, seed=11).load_all()


def test_adapter_produces_examples():
    ex = _examples(10)
    assert len(ex) > 0
    assert ex[0].features.role and ex[0].labels.transition_in


def test_model_learns_above_chance():
    ex = _examples(80)
    cut = int(len(ex) * 0.8)
    train, val = ex[:cut], ex[cut:]
    heads = {"transition_in": "classification", "final_duration_s": "regression"}
    model = StyleModel(heads).fit(train)
    rep = evaluate(model, val)
    # las reglas ocultas del adaptador son aprendibles -> muy por encima del azar
    assert rep["transition_in"]["top1"] > 0.5, rep
    assert rep["final_duration_s"]["mae"] < 1.5, rep


def test_json_roundtrip():
    ex = _examples(40)
    model = StyleModel({"transition_in": "classification"}).fit(ex)
    blob = json.dumps(model.to_json())
    restored = StyleModel.from_json(json.loads(blob))
    a = model.rank(ex[0], "transition_in")
    b = restored.rank(ex[0], "transition_in")
    assert a[0][0] == b[0][0]


def test_export_profile():
    ex = _examples(40)
    heads = {h: s["type"] for h, s in DEFAULT["heads"].items()}
    model = StyleModel(heads).fit(ex)
    with tempfile.TemporaryDirectory() as d:
        out = export_style_profile(model, Path(d) / "style_profile.json", DEFAULT)
        data = json.loads(out.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert "transition_in" in data["heads"]
    assert len(data["heads"]["transition_in"]["policy"]) > 0


if __name__ == "__main__":
    test_adapter_produces_examples()
    test_model_learns_above_chance()
    test_json_roundtrip()
    test_export_profile()
    print("OK — todos los tests de humo pasaron.")
