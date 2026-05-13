#!/bin/bash
# Propósito: Instalar Playwright MCP + clonar skills de Higgsfield/Seedance para Claude Code
# Origen: Creative Autopilot System (Higgsfield + Seedance 2.0)
# API Keys necesarias: Ninguna (Playwright controla el browser; Higgsfield es web app)
# Cómo ejecutar: chmod +x install_higgsfield_agents.sh && ./install_higgsfield_agents.sh

claude mcp add -s user playwright -- npx '@playwright/mcp@latest'
git clone https://github.com/beshuaxian/higgsfield-seedance2-jineng.git ~/.claude/skills/hf-tmp && cp -R ~/.claude/skills/hf-tmp/higgsfield-* ~/.claude/skills/ && rm -rf ~/.claude/skills/hf-tmp
