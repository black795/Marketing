"""
Carga de configuración.

Lee ml/config.yaml si existe (y si pyyaml está instalado); si no, usa DEFAULT.
Así el pipeline corre aunque todavía no toques el YAML. El YAML sólo SOBREESCRIBE
las claves que declares; el resto se hereda de DEFAULT.
"""
from __future__ import annotations

from pathlib import Path

_ML_ROOT = Path(__file__).resolve().parents[1]

DEFAULT: dict = {
    "dataset": {
        "adapter": "synthetic",      # cambia a "jsonl" cuando llegue tu dataset
        "root": None,                 # ruta del dataset (para jsonl/propios)
        "options": {"n_projects": 60},
    },
    # Cada decisión a aprender. Apaga una con enabled: false.
    "heads": {
        "transition_in":    {"type": "classification", "enabled": True},
        "caption_style":    {"type": "classification", "enabled": True},
        "animation":        {"type": "classification", "enabled": True},
        "final_duration_s": {"type": "regression",     "enabled": True},
    },
    "training": {"val_frac": 0.2, "seed": 7},
    "export": {"top_k": 3},
    "paths": {"models_dir": "data/models"},
}


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = _deep_merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


def load_config(path: str | Path | None = None) -> dict:
    cfg_path = Path(path) if path else _ML_ROOT / "config.yaml"
    if not cfg_path.exists():
        return DEFAULT
    try:
        import yaml  # type: ignore
    except ImportError:
        print("[config] pyyaml no instalado; usando configuración por defecto.")
        return DEFAULT
    with open(cfg_path, encoding="utf-8") as fh:
        user = yaml.safe_load(fh) or {}
    return _deep_merge(DEFAULT, user)
