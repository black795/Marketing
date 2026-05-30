"""
Esquema canónico del dataset de estilo de edición.

Esta es la ÚNICA forma de datos que el resto del programa entiende. Da igual de
dónde venga el dataset (CapCut, Premiere, un export propio, etc.): un adaptador
lo convierte a estos dataclasses y a partir de aquí todo es uniforme.

Filosofía:
  - `SceneFeatures` = lo que se SABE de una escena ANTES de decidir (percepción).
  - `SceneLabels`   = lo que TÚ decidiste para esa escena (el objetivo a aprender).
  - `Example`       = un par (features → labels) de una escena de un proyecto.

`extra` existe en ambos para no perder señal: si tu dataset trae un campo que
todavía no modelamos, vive ahí hasta que decidamos promoverlo a campo de primera
clase. Nada se tira.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


# Valores categóricos conocidos. No son cerrados: el vocabulario real se aprende
# del dataset (ver features/vocab.py). Estos son sólo los "arranque en frío".
ROLES = ("hook", "body", "cta", "intro", "outro", "broll")
EMOTIONS = ("neutral", "excited", "serious", "inspirational", "urgent", "calm", "playful")


@dataclass
class SceneFeatures:
    """Lo que se conoce de una escena antes de tomar decisiones de edición."""

    duration_s: float = 0.0            # duración cruda del clip fuente
    audio_energy: float = 0.0          # 0..1 energía/loudness del audio
    motion: float = 0.0                # 0..1 cantidad de movimiento visual
    has_face: bool = False
    has_speech: bool = False
    scene_index: int = 0               # posición en el timeline
    scene_count: int = 1               # total de escenas del proyecto
    role: str = "body"                 # hook/body/cta/...
    emotion: str = "neutral"
    prev_emotion: Optional[str] = None # emoción de la escena anterior (None si es la 1ª)
    beat_near_cut: bool = False        # ¿hay un beat musical cerca del corte?
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def position(self) -> float:
        """Posición relativa 0..1 dentro del timeline."""
        if self.scene_count <= 1:
            return 0.0
        return self.scene_index / (self.scene_count - 1)


@dataclass
class SceneLabels:
    """Lo que el editor (tú) decidió para la escena. Es el objetivo a aprender.

    Todos son opcionales: un proyecto puede no tener transición o no llevar caption.
    `None` significa "no aplica / sin dato" y se trata como una clase aparte.
    """

    transition_in: Optional[str] = None   # 'cut','fade','whip','zoom-in',...
    caption_style: Optional[str] = None   # 'hormozi-bold','clean','karaoke',...
    animation: Optional[str] = None        # animación de entrada del texto/clip
    final_duration_s: Optional[float] = None  # duración tras tu trim (regresión)
    sfx: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Example:
    """Una escena etiquetada: features → labels."""

    project_id: str
    scene_id: str
    features: SceneFeatures
    labels: SceneLabels

    def to_json(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "scene_id": self.scene_id,
            "features": asdict(self.features),
            "labels": asdict(self.labels),
        }

    @staticmethod
    def from_json(d: dict[str, Any]) -> "Example":
        return Example(
            project_id=d["project_id"],
            scene_id=d["scene_id"],
            features=SceneFeatures(**d["features"]),
            labels=SceneLabels(**d["labels"]),
        )
