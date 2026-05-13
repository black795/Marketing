# AI Motion Design System — Claude Code + Krea

## Propósito
Sistema completo para generar videos de motion design 3D virales en 10 segundos en lugar de 3 horas en Cinema 4D. Se construye un Node App en Krea con personajes de vinilo 3D animados, luego Claude Code automatiza todo el pipeline vía API de Krea.

## Conceptos Clave
- **Krea Node App** — workflow visual de nodos en krea.ai que procesa imagen → personaje 3D → video motion design
- **Node Agent** — agente dentro de Krea que ensambla nodos automáticamente desde un prompt
- **version_id** — ID del Node App publicado, necesario para llamar la API
- **Claude Code Setup Prompt** — prompt que le das a Claude Code para que escriba el script Python completo de integración Krea
- **8 motion design prompts** — prompts listos para Kling/Seedance: Bounce, Ease In/Out, Pendulum, Spin Snap, Tilt, Surprise, Wink, Bubblegum Pop

## Plataformas y APIs
- **Krea API** (`api.krea.ai`) — autenticación: `KREA_API_KEY`
  - `POST /assets` — sube imagen
  - `POST /node-apps/<version_id>/execute` — dispara el flujo
  - `GET /jobs/{job_id}` — consulta estado cada 3 segundos
- Python (script generado por Claude Code)
- Kling / Seedance (para los 8 prompts de motion design)

## Bloques de Código
- `Scripts_Automatizacion/krea_motion_setup_prompt.txt` — prompt para Claude Code que genera el script Python de integración completo
- `Scripts_Automatizacion/krea_node_agent_build_prompt.txt` — prompt para el Node Agent de Krea (construye el workflow 3D automáticamente)
- `Scripts_Automatizacion/krea_3d_character_prompt.txt` — prompt del Node 1: personaje vinilo 3D
- `Scripts_Automatizacion/krea_motion_video_prompt.txt` — prompt del Node 2: animación de motion design
- `Scripts_Automatizacion/krea_8_motion_prompts.txt` — 8 prompts de motion design listos para Kling/Seedance
