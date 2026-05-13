# Seedance 2.0 Master Guide — Dirección Cinematográfica con IA

## Propósito
Guía maestra para dominar Seedance 2.0 en OpenArt: inputs multimodales (9 imágenes + 3 videos + 3 audios), arquitectura de prompt de 6 capas y generación multi-shot con brackets. Convierte el prompting en dirección real de película.

## Conceptos Clave
- **Seedance 2.0** — modelo de video de ByteDance disponible en OpenArt con capacidad multimodal masiva
- **12 slots de referencia** — 9 imágenes + 3 videos + 3 audios en una sola generación
- **Character lock** — 1 portrait limpio + frase `identity stays locked on reference face`
- **Arquitectura de 6 capas** — orden obligatorio: SUBJECT → ACTION → ENVIRONMENT → CAMERA → STYLE → CONSTRAINTS
- **Multi-shot con brackets** — genera escenas multi-plano en un solo prompt usando `[Shot 1, X seconds: ...]`
- **Positive Constraints** — Seedance NO soporta prompts negativos; usar equivalentes positivos
- **Palabras que causan caos** — evitar: "fast", "cinematic", "epic", "dynamic", "lots of movement"
- **Longitud** — 60-100 palabras por plano; 150-200 para 3 planos; máx 200 palabras
- **Audio Engine nativo** — Seedance genera audio (voz, SFX, música) desde descripciones en el prompt
- **Claude Code Skill** — skill gratuito en `github.com/timkoda/seedance-skill` para generar prompts perfectos

## Plataformas y APIs
- OpenArt (`openart.ai`) — plataforma principal para Seedance 2.0
- Anthropic Claude Code (skill de Seedance)
- No requiere API key directa — acceso vía OpenArt

## Bloques de Código
- `Scripts_Automatizacion/seedance_6layer_master_template.txt` — plantilla maestra de 6 capas con ejemplo verificado
- `Scripts_Automatizacion/seedance_multishot_bracket_example.txt` — ejemplo completo de 3 planos con bracket syntax
- `Scripts_Automatizacion/seedance_positive_constraints_dictionary.txt` — diccionario de constraints positivos
- `Scripts_Automatizacion/seedance_audio_prompting_dictionary.txt` — diccionario de audio: voz, SFX, música, acústica
