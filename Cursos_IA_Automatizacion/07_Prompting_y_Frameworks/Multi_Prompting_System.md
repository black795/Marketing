# MULTI PROMPTING SYSTEM — Sistema de Prompts Encadenados

## Propósito
Sistema para mantener consistencia visual a través de múltiples generaciones usando un "master prompt" o system prompt que establece las reglas para el LLM. La misma iluminación, mismo estilo, mismo personaje aparecen en todos los shots porque el LLM sigue las mismas reglas.

## Conceptos Clave
- **System prompt / Master prompt** — prompt que establece las reglas visuales globales para todas las generaciones subsecuentes
- **Multi-angle shoot** — desde el mismo master prompt, generar shots desde múltiples ángulos
- **Shot list** — lista completa de planos que quieres generar antes de empezar
- **Consistencia cross-shot** — misma iluminación, mismo personaje, mismo entorno en todos los frames
- **Encadenamiento** — cada prompt referencia el master para mantener coherencia

## Plataformas y APIs
- Compatible con todos los modelos de imagen y video
- LLMs para generar el master prompt: Claude, ChatGPT, Gemini

## Bloques de Código
- `Scripts_Automatizacion/multi_prompting_master_template.txt` — estructura de master prompt para consistencia multi-shot
