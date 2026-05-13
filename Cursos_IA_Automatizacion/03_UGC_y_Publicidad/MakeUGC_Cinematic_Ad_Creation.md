# MakeUGC — Cinematic Ad Creation Workflow

## Propósito
Workflow para crear anuncios UGC cinematográficos de 6 escenas usando MakeUGC (powered by Sora 2). Genera storyboards completos con estructura JSON y produce videos multi-escena con consistencia. Diferencia clave vs Arcads: MakeUGC usa Sora 2 para generación de video cinematográfico multi-escena.

## Conceptos Clave
- **MakeUGC** — plataforma de creación de ads UGC con video multi-escena (Sora 2 + actores IA)
- **6-frame storyboard JSON** — estructura de 6 planos cinematográficos generada por LLM a partir de 1 idea
- **Style Bible** — JSON con genre, mood, color_palette, visual_references definidos antes de los frames
- **Shot, Camera, Lighting, Action** — 4 campos por frame que definen exactamente cómo se verá cada plano
- **Nim.video** — alternativa similar para creación de UGC ad videos

## Plataformas y APIs
- MakeUGC (plataforma principal)
- Sora 2 (motor de video subyacente)
- Nim.video (alternativa)
- Arcads AI (para UGC con actores específicos por API)

## Bloques de Código
- `Scripts_Automatizacion/makeugc_6scene_storyboard_prompt.txt` — mega-prompt para LLM que genera storyboard de 6 frames en JSON para MakeUGC
