# Claude Resolve Stack — Control de DaVinci Resolve con MCP

## Propósito
Integración de Claude Code con DaVinci Resolve mediante MCP para controlar el editor de video con lenguaje natural. Claude Code accede a más de 215 funciones de Resolve (cortes, color grading, efectos, exportación) desde la terminal.

## Conceptos Clave
- **resolve-mcp** — servidor MCP que expone la API de DaVinci Resolve a Claude Code
- **DaVinci Resolve** — editor profesional de video con scripting Lua/Python integrado
- **uvx** — herramienta de Python para correr paquetes temporales sin instalación permanente
- **215 funciones** — cortes de timeline, color grading, gestión de medios, exportación, efectos

## Plataformas y APIs
- DaVinci Resolve (instalado localmente)
- `resolve-mcp` (GitHub: `barckley75/resolve-mcp`)
- Python/uvx (prerequisito)
- Claude Code MCP

## Bloques de Código
- `Scripts_Automatizacion/install_resolve_mcp.sh` — conecta Claude Code con DaVinci Resolve vía MCP con un solo comando
