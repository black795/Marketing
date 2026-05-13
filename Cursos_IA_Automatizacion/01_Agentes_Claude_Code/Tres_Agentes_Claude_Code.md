# 3 Claude Code Creative Agents — Sistema Multi-Agente

## Propósito
Sistema de 3 agentes especializados que trabajan juntos como un equipo creativo: Director Creativo (ideas → conceptos), Máquina de Contenido (imágenes → campaña visual), y Repurposer (video → múltiples formatos). Cada agente tiene un system prompt específico que define su rol.

## Conceptos Clave
- **Multi-agente** — varios agentes Claude Code con roles distintos trabajando en cadena
- **System prompt** — instrucciones de identidad que definen el comportamiento del agente
- **Director Creativo** — transforma ideas vagas en conceptos completos de Reel (Hook, Walkthrough, CTA, Moodboard)
- **Content Machine** — toma 1 imagen y genera campaña visual de 5 imágenes cohesivas
- **Repurposer** — convierte un Reel en carrusel de Instagram, hilo de X, post de LinkedIn y serie de Stories

## Plataformas y APIs
- Claude Code (cualquier plan)
- Fal.ai o Midjourney (para generación de imágenes en el agente de contenido)
- Plataformas destino: Instagram, X (Twitter), LinkedIn

## Bloques de Código
- `Scripts_Automatizacion/creative_director_agent_prompt.txt` — system prompt del agente Director Creativo
- `Scripts_Automatizacion/content_machine_agent_prompt.txt` — system prompt del agente de producción visual
- `Scripts_Automatizacion/repurposer_agent_prompt.txt` — system prompt del agente de repurposing multiplataforma
