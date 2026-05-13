# TapNow Product Shoot — Campaña Editorial Completa en 20 Minutos

## Propósito
Transforma cualquier foto de producto (incluso terrible) en una campaña editorial completa de 7 shots en 20 minutos. Proceso: limpiar producto en TapNow → LLM genera 7 prompts de campaña → Nano Banana o Flux los ejecuta → pulir en Lightroom.

## Conceptos Clave
- **3-step process** — Clean product → Generate campaign → Polish & export
- **7-shot campaign structure** — 2x Table Top + 2x On Figure + 2x Lifestyle + 1x Poster
- **LLM Creative Director Prompt** — mega-prompt que analiza el producto y referencias para generar los 7 prompts
- **Visual DNA extraction** — el LLM extrae: iluminación, paleta de colores, composición, ambiente, mood de las referencias
- **Prompt writing rules** — empezar con shot type, describir placement, entorno, iluminación, paleta, modelo (si on-figure)
- **Output JSON** — 7 prompts estructurados en JSON listo para Nano Banana o Flux
- **Polish** — Lightroom con noise, reflejos, texturas

## Plataformas y APIs
- TapNow AI (limpieza inicial de producto)
- LLM (Claude, ChatGPT, Gemini) para generación de prompts
- Nano Banana / Flux (ejecución de prompts)
- Adobe Lightroom (post-producción)

## Bloques de Código
- `Scripts_Automatizacion/tapnow_product_shoot_llm_prompt.txt` — mega-prompt completo de Creative Director para generar los 7 prompts de campaña editorial en JSON
