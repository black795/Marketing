# The Humanify System — Añadir Imperfecciones Humanas a Imágenes IA

## Propósito
Sistema de un prompt para eliminar el aspecto "AI perfecto" de las imágenes añadiendo imperfecciones orgánicas controladas: grano de película, ruido natural, bordes rugosos, imperfecciones de lente, texturas vividas. El resultado parece creado por humanos, no calculado por máquina.

## Conceptos Clave
- **Humanify prompt** — texto que se añade al final de cualquier prompt para inyectar imperfecciones
- **Film grain** — grano de película sutil que rompe la perfección digital
- **Lens imperfection** — ligeras aberraciones que simulan óptica real
- **Lived-in texture** — texturas que parecen haber sido usadas/vividas
- **Natural falloff** — iluminación con caída natural (no perfectamente uniforme)
- **"Not AI perfect"** — el objetivo explícito es que la imagen no parezca generada por IA

## Plataformas y APIs
- Compatible con todos los modelos de imagen: Midjourney, Flux, Recraft, Gemini, DALL-E

## Bloques de Código
- `Scripts_Automatizacion/humanify_texture_prompt.txt` — prompt de imperfecciones orgánicas para añadir al final de cualquier generación
