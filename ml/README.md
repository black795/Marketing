# Koda Style — motor de aprendizaje del estilo de edición

Aprende **tus** decisiones de edición (qué transición, qué caption, qué animación,
cuánto recortar) a partir de tus proyectos, y exporta un perfil que el motor de
`frontend/editing/` usa para editar como tú.

> **Estado:** esqueleto completo y ejecutable con datos sintéticos. Falta enchufar
> tu dataset real (un adaptador) y entrenar.

---

## Arranque rápido (hoy, sin tu dataset)

```bash
cd ml
pip install -r requirements.txt          # núcleo: numpy (+ pyyaml opcional)
python -m koda_style.training.train      # entrena con datos sintéticos
```

Verás el split, la accuracy de validación y dos archivos en `data/models/`:
- `style_model.json` — el modelo entrenado.
- `style_profile.json` — la tabla de preferencias que consume el motor TS.

Test de humo de la tubería completa:

```bash
python tests/test_smoke.py
```

---

## Cuando llegue TU dataset

Tienes dos caminos según el formato:

### A) Tu dataset ya es (o lo conviertes a) JSONL canónico
Un objeto por línea con la forma de `Example`:

```json
{"project_id":"p1","scene_id":"s0",
 "features":{"duration_s":4.2,"audio_energy":0.8,"role":"hook","emotion":"excited","has_speech":true},
 "labels":{"transition_in":"whip","caption_style":"hormozi-bold","animation":"pop","final_duration_s":2.1}}
```

Déjalo en `data/raw/mi_dataset.jsonl` y entrena:

```bash
python -m koda_style.training.train --adapter jsonl --root data/raw/mi_dataset.jsonl
```

(o pon `adapter: jsonl` y `root:` en `config.yaml`.)

### B) Tu dataset viene en formato propio
Escribe un adaptador: subclase de `DatasetAdapter` que implemente `load()` y
devuelva `Example`. Regístralo en `koda_style/dataset/registry.py`. Nada más del
programa cambia. Plantilla en `koda_style/dataset/jsonl.py`.

---

## Arquitectura (capas independientes)

```
dataset (adapter) → Example → features (encoder) → models (cabezas) → export → motor TS
```

| Capa | Archivo | Rol |
|---|---|---|
| Schema | `schema.py` | forma canónica `SceneFeatures` / `SceneLabels` / `Example` |
| Dataset | `dataset/` | adaptadores crudo→Example (`synthetic`, `jsonl`, los tuyos) |
| Features | `features/` | escena → vector numérico (`FeatureEncoder`, `Vocab`) |
| Modelos | `models/` | una cabeza por decisión (`StyleModel` orquesta) |
| Training | `training/` | `train.py` (CLI) + `evaluate.py` (top1/top3/MAE) |
| Inference | `inference/export.py` | → `style_profile.json` para el motor TS |

### Decisiones que aprende (configurable en `config.yaml`)
`transition_in`, `caption_style`, `animation` (clasificación) y `final_duration_s`
(regresión). Añadir/quitar = una línea en `heads:`.

---

## Plan de modelos (escalable, sin reescribir nada)

| Fase | Modelo | Datos | Cómo |
|---|---|---|---|
| **2 (ahora)** | Softmax / regresión lineal (numpy) | 20–300 escenas | ya implementado |
| **2.5** | XGBoost | 300–1.000 | nuevo `HeadModel` en `models/`, cumple la interfaz |
| **3** | Transformer de ritmo | 2.000+ | nuevo `HeadModel` que ve el timeline completo |

Cambiar de fase = añadir una clase que cumpla `HeadModel` y elegirla en
`StyleModel._make_head`. El dataset, las features, el training y el export no cambian.

---

## Lo que NO se entrena aquí (capa de percepción)

Para sacar las `features` desde un MP4 (transcripción, cortes, energía de audio)
se usan modelos **pre-entrenados locales** (Whisper, PySceneDetect, librosa). Eso
alimenta el `Example`; no es parte de este entrenamiento. Va en un paso aparte
(extractor → JSONL) que se conecta vía el adaptador `jsonl`.
```
MP4 ──(extractor: whisper/scenedetect)──> features ──> JSONL ──> adapter ──> aquí
```
