# Infinite Loop Effect Guide — Video Loop Cinematográfico Infinito

## Propósito
Workflow completo de 3 pasos para crear un efecto de loop infinito de tracking: la cámara sigue hacia la izquierda revelando continuamente un nuevo look (mismo entorno, outfit diferente). El espectador no puede detectar dónde empieza o termina.

## Conceptos Clave
- **Infinite Loop** — video sin inicio ni fin perceptible; transiciones invisibles entre clips
- **InVideo / Nano Banana** — generación de imágenes base con JSON prompt que bloquea todos los parámetros (fondo, lente, iluminación, composición)
- **JSON Prompt Structure** — bloquea: background (white infinity cyc), lente (70mm f/4), iluminación (high-key softbox), composición (centered full body), color grade (neutral, low saturation)
- **Kling 2.5** — animación de tracking shot (dolly left) con prompt idéntico para cada clip = velocidad consistente
- **Premiere Pro** — edición final: speed ramp en transiciones (120-150%), cross dissolve (3-5 frames), Lumetri Color
- **Seed fijo** — `"seed": 90417322` para reproducibilidad del estilo

## Plataformas y APIs
- InVideo (con Nano Banana como modelo de generación)
- Kling 2.5 (Image to Video, 5 segundos, motion Medium, camera Left tracking)
- Adobe Premiere Pro (edición y export: H.264, 1080x1920, 30fps, VBR 2-pass 15-20 Mbps)

## Bloques de Código
- `Scripts_Automatizacion/infinite_loop_json_prompt.json` — JSON completo de generación de imagen base (bloquea todos los parámetros visuales)
- `Scripts_Automatizacion/infinite_loop_kling_tracking_prompt.txt` — prompt de tracking shot para Kling 2.5 (mismo para todos los clips)
