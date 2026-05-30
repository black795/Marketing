"""
Punto de entrada de entrenamiento.

    python -m koda_style.training.train                 # usa config.yaml
    python -m koda_style.training.train --adapter synthetic
    python -m koda_style.training.train --adapter jsonl --root data/raw/mi_dataset.jsonl

Flujo: adaptador → Examples → split train/val → StyleModel.fit → evaluate →
guarda el modelo (models/style_model.json) y exporta el perfil para el motor TS
(models/style_profile.json).

Para entrenar con TU dataset, sólo cambia el adaptador (o el root). Nada más.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from ..config import load_config
from ..dataset.registry import get_adapter, available
from ..models.multihead import StyleModel
from .evaluate import evaluate, format_report

# raíz del paquete ml/ (…/ml)
_ML_ROOT = Path(__file__).resolve().parents[2]


def split(examples, val_frac: float, seed: int):
    """Split POR PROYECTO (no por escena) para no filtrar info del mismo video."""
    rng = random.Random(seed)
    projects = sorted({e.project_id for e in examples})
    rng.shuffle(projects)
    n_val = max(1, int(len(projects) * val_frac)) if len(projects) > 1 else 0
    val_ids = set(projects[:n_val])
    train = [e for e in examples if e.project_id not in val_ids]
    val = [e for e in examples if e.project_id in val_ids]
    return train, val


def main(argv=None) -> int:
    cfg = load_config()
    ap = argparse.ArgumentParser(description="Entrena el modelo de estilo de edición.")
    ap.add_argument("--adapter", default=cfg["dataset"]["adapter"], help=f"uno de: {available()}")
    ap.add_argument("--root", default=cfg["dataset"].get("root"), help="ruta del dataset (si aplica)")
    ap.add_argument("--out", default=str(_ML_ROOT / cfg["paths"]["models_dir"]))
    args = ap.parse_args(argv)

    adapter_kwargs = dict(cfg["dataset"].get("options", {}))
    if args.root:
        adapter_kwargs["root"] = args.root
    adapter = get_adapter(args.adapter, **adapter_kwargs)

    print(f"[1/4] Cargando dataset via adaptador '{args.adapter}' ...")
    examples = adapter.load_all()
    print(f"      {len(examples)} escenas de {len({e.project_id for e in examples})} proyectos.")
    if not examples:
        print("      Dataset vacío. Abortando.")
        return 1

    train, val = split(examples, cfg["training"]["val_frac"], cfg["training"]["seed"])
    print(f"[2/4] Split: {len(train)} train / {len(val)} val (por proyecto).")

    heads = {h: spec["type"] for h, spec in cfg["heads"].items() if spec.get("enabled", True)}
    print(f"[3/4] Entrenando cabezas: {list(heads)} ...")
    model = StyleModel(heads).fit(train)

    rep = evaluate(model, val or train)
    print(f"[4/4] Validación ({'val' if val else 'train (sin val)'}):")
    print(format_report(rep))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "style_model.json"
    model_path.write_text(json.dumps(model.to_json()), encoding="utf-8")
    print(f"\nModelo guardado: {model_path}")

    # export del perfil consumible por el motor TS
    from ..inference.export import export_style_profile
    profile_path = out_dir / "style_profile.json"
    export_style_profile(model, profile_path, cfg)
    print(f"Perfil exportado: {profile_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
