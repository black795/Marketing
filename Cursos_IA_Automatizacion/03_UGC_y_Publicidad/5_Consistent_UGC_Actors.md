# 5 Consistent UGC Actors — Actores IA Consistentes con Nano Banana 2

## Propósito
Sistema para crear hasta 5 actores UGC de IA completamente consistentes usando Nano Banana 2 (Google Gemini 3.1 Flash Image). Los actores pueden aparecer juntos en escenas grupales manteniendo identidad individual. Soporta hasta 5 referencias de personaje simultáneas.

## Conceptos Clave
- **Nano Banana 2** — modelo basado en Google Gemini 3.1 Flash Image con soporte de hasta 5 referencias de personaje
- **Character reference photos** — retratos selfie generados con prompt específico que sirven como DNA visual del actor
- **Multi-character scenes** — hasta 5 actores en la misma escena con identidades distintas
- **UGC aesthetic** — estilo iPhone selfie, iluminación natural, fondo neutro, expresión casual
- **Video UGC** — los personajes pueden ser animados en video con estilo cámara frontal iPhone

## Plataformas y APIs
- Nano Banana 2 (Google Gemini 3.1 Flash Image, disponible en InVideo/Freepik)
- Kling / Higgsfield (para animar los personajes en video)

## Bloques de Código
- `Scripts_Automatizacion/ugc_actor_consistency_portrait_prompt.txt` — prompt para generar foto de referencia de personaje UGC
- `Scripts_Automatizacion/ugc_scene_multi_actor_prompt.txt` — prompt para escenas con múltiples actores UGC
- `Scripts_Automatizacion/ugc_video_iphone_prompt.txt` — prompt para animar actor UGC en video estilo iPhone frontal
