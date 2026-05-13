# Creative Autopilot System — Higgsfield + Seedance 2.0

## Propósito
Sistema automatizado que conecta Claude Code con Higgsfield/Seedance 2.0 a través de Playwright MCP para controlar el navegador y automatizar la generación de video IA. Claude Code actúa como director creativo autónomo.

## Conceptos Clave
- **Playwright MCP** — plugin que da a Claude Code control completo del navegador (clics, formularios, scraping)
- **Higgsfield** — plataforma de generación de video IA con features como Shot, Motion Control, Seedance 2.0
- **Seedance 2.0** — modelo de video de ByteDance con inputs multimodales (hasta 9 imágenes + 3 videos + 3 audios)
- **Skills de Claude Code** — carpetas `~/.claude/skills/` con capacidades preconstruidas
- **Creative Autopilot** — agente que ejecuta flujos creativos de principio a fin sin intervención manual

## Plataformas y APIs
- Playwright MCP (`@playwright/mcp@latest`)
- Higgsfield (web app, controlada por browser automation)
- Seedance 2.0 (via Higgsfield o OpenArt)
- GitHub (clonación de skills)

## Bloques de Código
- `Scripts_Automatizacion/install_higgsfield_agents.sh` — instala Playwright MCP y clona skills de Higgsfield/Seedance en `~/.claude/skills/`
