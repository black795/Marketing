"""
Vocabularios: mapean valores categóricos (roles, emociones, y las CLASES de cada
decisión) a índices enteros, y al revés. Se aprenden del dataset, no se hardcodean.

Un Vocab reserva el índice 0 para "<unk>/None" — así nunca explota si en
inferencia aparece un valor que no se vio al entrenar.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Vocab:
    name: str
    itos: list[str] = field(default_factory=lambda: ["<unk>"])
    stoi: dict[str, int] = field(default_factory=lambda: {"<unk>": 0})

    def add(self, token: str | None) -> int:
        key = "<unk>" if token is None else str(token)
        if key not in self.stoi:
            self.stoi[key] = len(self.itos)
            self.itos.append(key)
        return self.stoi[key]

    def encode(self, token: str | None) -> int:
        key = "<unk>" if token is None else str(token)
        return self.stoi.get(key, 0)

    def decode(self, idx: int) -> str:
        return self.itos[idx] if 0 <= idx < len(self.itos) else "<unk>"

    def __len__(self) -> int:
        return len(self.itos)

    def to_json(self) -> dict:
        return {"name": self.name, "itos": self.itos}

    @staticmethod
    def from_json(d: dict) -> "Vocab":
        v = Vocab(name=d["name"], itos=list(d["itos"]))
        v.stoi = {t: i for i, t in enumerate(v.itos)}
        return v

    @staticmethod
    def build(name: str, tokens) -> "Vocab":
        v = Vocab(name=name)
        for t in tokens:
            v.add(t)
        return v
