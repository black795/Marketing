"""
Adaptador SINTÉTICO — datos falsos pero con estructura realista.

Sirve para una cosa: que TODA la tubería (features → modelo → entrenamiento →
export) corra hoy, sin tu dataset, y puedas verla funcionar de punta a punta.

Genera ejemplos donde las labels SÍ dependen de las features siguiendo reglas
ocultas (p.ej. emoción 'urgent' → transición 'whip'). Así, si el modelo entrena
bien, debería recuperar esas reglas y la accuracy de validación sube — prueba de
que el pipeline aprende de verdad.

Cuando tengas tu dataset real, este adaptador se reemplaza; no se borra (lo usan
los tests de humo).
"""
from __future__ import annotations

import random
from typing import Iterator

from ..schema import Example, SceneFeatures, SceneLabels, ROLES, EMOTIONS
from .base import DatasetAdapter

_TRANSITIONS = ["cut", "fade", "whip", "zoom-in", "slide-left"]
_CAPTIONS = ["clean", "hormozi-bold", "karaoke", "minimal"]
_ANIMS = ["none", "pop", "slide-up", "typewriter"]


def _hidden_transition(f: SceneFeatures) -> str:
    """Regla oculta que el modelo debería aprender a recuperar."""
    if f.role == "cta":
        return "zoom-in"
    if f.emotion == "urgent" or f.audio_energy > 0.8:
        return "whip"
    if f.emotion == "calm":
        return "fade"
    if f.scene_index == 0:
        return "cut"
    return "slide-left"


def _hidden_caption(f: SceneFeatures) -> str:
    if not f.has_speech:
        return "minimal"
    if f.emotion in ("excited", "urgent"):
        return "hormozi-bold"
    if f.audio_energy > 0.5:
        return "karaoke"
    return "clean"


class SyntheticAdapter(DatasetAdapter):
    name = "synthetic"

    def __init__(self, root=None, n_projects: int = 40, seed: int = 7, **opt):
        super().__init__(root, **opt)
        self.n_projects = int(opt.get("n_projects", n_projects))
        self.seed = int(opt.get("seed", seed))

    def load(self) -> Iterator[Example]:
        rng = random.Random(self.seed)
        for p in range(self.n_projects):
            n_scenes = rng.randint(4, 12)
            prev_emotion = None
            for i in range(n_scenes):
                role = "hook" if i == 0 else ("cta" if i == n_scenes - 1 else rng.choice(ROLES))
                emotion = rng.choice(EMOTIONS)
                f = SceneFeatures(
                    duration_s=round(rng.uniform(1.0, 8.0), 2),
                    audio_energy=round(rng.random(), 3),
                    motion=round(rng.random(), 3),
                    has_face=rng.random() > 0.4,
                    has_speech=rng.random() > 0.3,
                    scene_index=i,
                    scene_count=n_scenes,
                    role=role,
                    emotion=emotion,
                    prev_emotion=prev_emotion,
                    beat_near_cut=rng.random() > 0.5,
                )
                # trim: las escenas largas con poca energía se acortan más
                final = f.duration_s * (0.6 if f.audio_energy < 0.4 else 0.9)
                labels = SceneLabels(
                    transition_in=_hidden_transition(f),
                    caption_style=_hidden_caption(f) if f.has_speech else None,
                    animation=rng.choice(_ANIMS),
                    final_duration_s=round(final, 2),
                )
                yield Example(
                    project_id=f"synthetic-{p:03d}",
                    scene_id=f"s{i}",
                    features=f,
                    labels=labels,
                )
                prev_emotion = emotion
