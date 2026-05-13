# Claude Code Creative Pipeline Starter

## Propósito
Guía de instalación inicial para configurar Claude Code como pipeline creativo completo. Cubre instalación de Node.js, Claude Code, fal.ai, Remotion y la conexión con Notion vía MCP. Punto de entrada para nuevos usuarios en Mac.

## Conceptos Clave
- **Claude Code** — CLI de Anthropic que corre agentes de IA en tu terminal
- **fal.ai** — API de generación de imágenes/video IA (integración npm)
- **Remotion** — librería npm para ensamblar videos programáticamente
- **MCP (Model Context Protocol)** — sistema de plugins que conecta Claude Code con apps externas
- **Notion MCP** — integración oficial para que Claude Code lea/escriba en Notion

## Plataformas y APIs
- Node.js (prerequisito)
- Anthropic (plan Pro, Max, Teams o Enterprise requerido)
- fal.ai (`@fal-ai/client`)
- Remotion (`remotion`, `@remotion/cli`)
- Notion (`@notionhq/notion-mcp-server`)

## Bloques de Código
- `Scripts_Automatizacion/install_claude_code_mac.sh` — instala Claude Code + fal.ai + Remotion + Notion MCP
- `Scripts_Automatizacion/remotion_render.sh` — comandos para renderizar y previsualizar video con Remotion
