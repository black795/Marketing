#!/bin/bash
# Propósito: Instalar Claude Code + fal.ai + Remotion + Notion MCP en Mac
# Origen: Claude Code Creative Pipeline Starter
# API Keys necesarias: Anthropic (login al lanzar 'claude'), fal.ai (configurar en el proyecto)
# Cómo ejecutar: chmod +x install_claude_code_mac.sh && ./install_claude_code_mac.sh

npm install -g @anthropic-ai/claude-code
npm i @fal-ai/client
npm i remotion @remotion/cli
claude mcp add notion npx @notionhq/notion-mcp-server
