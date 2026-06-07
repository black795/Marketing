"""
Adaptador CapCut/CapCut-PC (carpetas de borrador `draft_content.json`).

Lee proyectos terminados de CapCut y los convierte a `Example` canónicos. A
diferencia de partir de un MP4 renderizado, acá tenemos las DECISIONES REALES de
edición: duración de cada clip en el timeline, transiciones, animaciones y
captions. Eso son labels de verdad, no inferencias.

Qué hace:
  - `root` puede ser un `draft_content.json`, una carpeta de proyecto, o una
    carpeta raíz con muchos proyectos (recorre recursivo).
  - Ignora los `Timelines/.../draft_content.json` (sub-timelines) y deduplica por
    el `id` del borrador (los exports suelen traer copias del mismo proyecto).
  - Toma el track de video con más segmentos como "espina" (la secuencia de
    escenas), ordena por tiempo y emite un `Example` por segmento.

Mapeo (tiempos de CapCut en microsegundos → segundos):
  LABELS
    final_duration_s = segment.target_timerange.duration   (el ritmo: lo que dura en el timeline)
    transition_in    = nombre de la transición en el borde de entrada, o "none"
    animation        = nombre de la animación de entrada del clip, o "none"
    caption_style    = fuente/estilo de caption dominante del proyecto, o "none"
  FEATURES (lo conocible del clip antes de decidir)
    duration_s   = duración cruda del material fuente
    scene_index / scene_count / position
    has_audio, motion(≈ por speed), audio_energy(≈ por volumen normalizado)
    role         = hook (primera) / cta (última) / body
    beat_near_cut= hay un beat musical cerca del inicio del clip
  Lo que no se conoce (emotion, has_face) queda en su default; el resto crudo va
  a `extra` para no perder señal.
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Iterator, Optional

from ..schema import Example, SceneFeatures, SceneLabels
from .base import DatasetAdapter

_USEC = 1_000_000.0
_BEAT_WINDOW_USEC = 120_000  # ±0.12s para considerar un corte "sobre el beat"


def _slug(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^\w\- ]+", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "default"


def _find_drafts(root: Path) -> list[Path]:
    """draft_content.json bajo `root` (recursivo), sin los sub-timelines."""
    if root.is_file():
        return [root]
    out: list[Path] = []
    for p in root.rglob("draft_content.json"):
        parts = {seg.lower() for seg in p.parts}
        if "timelines" in parts:
            continue
        out.append(p)
    return out


_GENERIC_FONT = {"font", "en", ""}


def _font_key(font_path: str) -> Optional[str]:
    """Identifica la fuente. CapCut guarda las descargadas como `font.ttf`, así
    que el nombre real está en el id de efecto de la ruta
    (.../effect/<EFFECT_ID>/<hash>/font.ttf): lo usamos como fallback estable."""
    fp = str(font_path or "")
    if not fp:
        return None
    base = os.path.splitext(os.path.basename(fp))[0]
    if base.lower() not in _GENERIC_FONT:
        return _slug(base)
    # fallback: id de efecto (carpeta numérica tras "effect")
    parts = re.split(r"[\\/]+", fp)
    for i, seg in enumerate(parts):
        if seg.lower() == "effect" and i + 1 < len(parts) and parts[i + 1].isdigit():
            return f"font-{parts[i + 1]}"
    return None


def _dominant_caption_style(materials: dict) -> Optional[str]:
    """Fuente de caption dominante del proyecto (proxy del estilo de subtítulo)."""
    fonts: Counter = Counter()
    for t in materials.get("texts", []) or []:
        content = t.get("content")
        if not content:
            continue
        try:
            c = json.loads(content)
        except Exception:
            continue
        styles = c.get("styles") or []
        if not styles:
            continue
        key = _font_key((styles[0].get("font") or {}).get("path", ""))
        if key:
            fonts[key] += 1
    if not fonts:
        return None
    return fonts.most_common(1)[0][0]


def _collect_beats(materials: dict) -> list[int]:
    times: list[int] = []
    for b in materials.get("beats", []) or []:
        for arr_key in ("user_beats",):
            arr = b.get(arr_key)
            if isinstance(arr, list):
                times.extend(int(x) for x in arr if isinstance(x, (int, float)))
        ai = b.get("ai_beats") or {}
        # ai_beats a veces trae listas de tiempos en distintas claves; tolerante.
        for k, v in ai.items():
            if "beat" in k.lower() and isinstance(v, list):
                times.extend(int(x) for x in v if isinstance(x, (int, float)))
    return sorted(set(times))


def _beat_near(beats: list[int], t_usec: int) -> bool:
    # búsqueda lineal: las listas de beats por proyecto son chicas (decenas).
    return any(abs(b - t_usec) <= _BEAT_WINDOW_USEC for b in beats)


class CapcutAdapter(DatasetAdapter):
    name = "capcut"

    def __init__(self, root=None, min_segments: int = 2, **opt):
        super().__init__(root, **opt)
        self.min_segments = int(opt.get("min_segments", min_segments))

    def load(self) -> Iterator[Example]:
        if self.root is None or not self.root.exists():
            raise FileNotFoundError(
                f"CapcutAdapter necesita un draft_content.json o una carpeta; recibí: {self.root}"
            )
        seen_ids: set[str] = set()
        for draft_path in _find_drafts(self.root):
            try:
                d = json.loads(draft_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            draft_id = str(d.get("id") or draft_path.parent.name)
            if draft_id in seen_ids:
                continue

            tracks = d.get("tracks", []) or []
            video_tracks = [t for t in tracks if t.get("type") == "video"]
            if not video_tracks:
                continue
            spine = max(video_tracks, key=lambda t: len(t.get("segments", []) or []))
            segs = sorted(
                spine.get("segments", []) or [],
                key=lambda s: (s.get("target_timerange") or {}).get("start", 0),
            )
            if len(segs) < self.min_segments:
                continue
            seen_ids.add(draft_id)

            mats = d.get("materials", {}) or {}
            transitions = {x["id"]: x for x in mats.get("transitions", []) or [] if "id" in x}
            anims = {a["id"]: a for a in mats.get("material_animations", []) or [] if "id" in a}
            videos = {v["id"]: v for v in mats.get("videos", []) or [] if "id" in v}
            beats = _collect_beats(mats)
            caption_style = _dominant_caption_style(mats)

            project_id = f"{draft_path.parent.name}::{draft_id[:8]}"
            n = len(segs)
            for i, seg in enumerate(segs):
                tt = seg.get("target_timerange") or {}
                final_dur = float(tt.get("duration", 0)) / _USEC
                start_usec = int(tt.get("start", 0))
                refs = seg.get("extra_material_refs", []) or []
                mat_id = seg.get("material_id")
                vid = videos.get(mat_id, {})

                # Fuente: duración cruda del material y aspecto.
                src_dur = float(vid.get("duration", 0)) / _USEC
                width = vid.get("width") or 0
                height = vid.get("height") or 0
                has_audio = bool(vid.get("has_audio", False))

                # Transición de entrada: la que está atada al borde de este clip.
                tr_name = "none"
                for r in refs:
                    tr = transitions.get(r)
                    if tr:
                        tr_name = _slug(tr.get("name") or tr.get("category_name") or "transition")
                        break

                # Animación de entrada (si hay alguna con contenido).
                anim_name = "none"
                for r in refs:
                    a = anims.get(r)
                    if a and a.get("animations"):
                        ins = [x for x in a["animations"] if "in" in str(x.get("type", "")).lower()]
                        pick = (ins or a["animations"])[0]
                        anim_name = _slug(pick.get("name") or "anim")
                        break

                speed = float(seg.get("speed", 1.0) or 1.0)
                volume = float(seg.get("volume", 1.0) or 0.0)

                feats = SceneFeatures(
                    duration_s=round(src_dur, 3),
                    audio_energy=round(min(1.0, volume / 2.0), 3) if has_audio else 0.0,
                    motion=round(min(1.0, max(0.0, (speed - 1.0))), 3),
                    has_face=False,
                    has_speech=has_audio,
                    scene_index=i,
                    scene_count=n,
                    role="hook" if i == 0 else ("cta" if i == n - 1 else "body"),
                    emotion="neutral",
                    prev_emotion=None,
                    beat_near_cut=_beat_near(beats, start_usec),
                    extra={
                        "speed": speed,
                        "width": width,
                        "height": height,
                        "vertical": bool(height and width and height >= width),
                        "volume": volume,
                    },
                )
                labels = SceneLabels(
                    transition_in=tr_name,
                    caption_style=caption_style,
                    animation=anim_name,
                    final_duration_s=round(final_dur, 3),
                )
                yield Example(
                    project_id=project_id,
                    scene_id=f"s{i}",
                    features=feats,
                    labels=labels,
                )
