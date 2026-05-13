# How to Handle Impossible Product Shots — Sistema de 3 Pasos

## Propósito
Sistema de 3 pasos para entregar fotografía de producto en escenarios que no existen físicamente, en 10 minutos en lugar de $15K de producción. Combina extracción de intención visual con Claude, generación iterativa y polish final.

## Conceptos Clave
- **Visual Intent Document** — documento que extrae dirección creativa completa antes de generar (mood, colores, iluminación, composición, texturas, escala, perspectiva)
- **Claude Project** — espacio de conversación con memoria donde se sube el brief + moodboard para extraer el DNA visual
- **360° packshot JSON** — prompt JSON para Gemini 2.5 Flash Image que genera 24 vistas de producto (15° increment) y las ensambla en una hoja de contacto 6x4
- **Iterative pipeline** — generar amplio primero → refinar estrecho → inpainting para ajustes quirúrgicos
- **Upscaling 4K+** — Topaz / Magnific para resolución de producción
- **Micro-refinement** — añadir imperfecciones controladas para que parezca fotografía real

## Plataformas y APIs
- Claude (Claude Project para extracción de Visual Intent)
- Gemini 2.5 Flash Image (generación con JSON prompt estructurado)
- Midjourney / Flux / Stable Diffusion (generación base)
- Topaz / Magnific AI (upscaling)

## Bloques de Código
- `Scripts_Automatizacion/product_360_packshot_json_prompt.json` — JSON completo para generar 24 vistas turntable + product sheet 6x4 con Gemini
