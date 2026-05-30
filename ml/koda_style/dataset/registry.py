"""
Registro de adaptadores: nombre -> clase.

Permite elegir el dataset por string (en config.yaml o en la CLI) sin tocar código:

    adapter = get_adapter("synthetic", n_projects=50)
    adapter = get_adapter("jsonl", root="data/raw/mi_dataset.jsonl")

Para registrar TU adaptador nuevo: impórtalo aquí y añádelo a _ADAPTERS.
"""
from __future__ import annotations

from .base import DatasetAdapter
from .synthetic import SyntheticAdapter
from .jsonl import JsonlAdapter

_ADAPTERS: dict[str, type[DatasetAdapter]] = {
    SyntheticAdapter.name: SyntheticAdapter,
    JsonlAdapter.name: JsonlAdapter,
}


def register(adapter_cls: type[DatasetAdapter]) -> None:
    _ADAPTERS[adapter_cls.name] = adapter_cls


def get_adapter(name: str, **kwargs) -> DatasetAdapter:
    if name not in _ADAPTERS:
        raise KeyError(
            f"Adaptador '{name}' no registrado. Disponibles: {sorted(_ADAPTERS)}"
        )
    return _ADAPTERS[name](**kwargs)


def available() -> list[str]:
    return sorted(_ADAPTERS)
