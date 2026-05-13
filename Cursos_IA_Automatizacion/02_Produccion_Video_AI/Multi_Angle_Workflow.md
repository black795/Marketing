# MULTI-ANGLE WORKFLOW — De 1 Imagen a 100+ Shots Profesionales

## Propósito
Workflow de 2 pasos que transforma 1 imagen en más de 100 fotos profesionales en 15 minutos y $0. Higgsfield genera 10 ángulos de cámara diferentes; Nano Banana Pro expande cada ángulo a 9 variaciones de entorno.

## Conceptos Clave
- **Higgsfield "Shot" Feature** — genera automáticamente 10 ángulos de cámara (aerial, side profile, macro, worm's eye, 3/4, wide, over-the-shoulder, dutch angle, low heroic, high cinematic)
- **Nano Banana Pro** — sistema basado en nodos que genera grids 3x3 manteniendo identidad exacta del sujeto
- **Consistencia** — mismo ángulo, misma iluminación, misma identidad; solo cambia el fondo/entorno
- **Output** — 1 imagen → 10 ángulos → 90 variaciones = 100+ fotos cohesivas
- **Equivalente real** — 3 días de shooting, $30K+, equipo de 15 personas

## Plataformas y APIs
- Higgsfield (Feature: Shot)
- Nano Banana Pro (sistema de nodos)
- No requiere código — flujo visual

## Bloques de Código
- `Scripts_Automatizacion/multi_angle_system_prompt_llm.txt` — system prompt para LLM que genera prompts de Nano Banana Pro
- `Scripts_Automatizacion/multi_angle_nano_banana_universal_prompt.txt` — prompt universal para grids 3x3 con Nano Banana Pro
