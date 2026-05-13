#!/bin/bash
# Propósito: Conectar Claude Code con DaVinci Resolve via MCP (215 funciones disponibles)
# Origen: Claude Resolve Stack — Control de DaVinci Resolve
# API Keys necesarias: Ninguna (DaVinci Resolve debe estar abierto localmente)
# Cómo ejecutar: chmod +x install_resolve_mcp.sh && ./install_resolve_mcp.sh
# Prerequisito: Python/uvx instalado; DaVinci Resolve corriendo en el sistema

claude mcp add resolve -- uvx --from git+https://github.com/barckley75/resolve-mcp resolve-mcp
