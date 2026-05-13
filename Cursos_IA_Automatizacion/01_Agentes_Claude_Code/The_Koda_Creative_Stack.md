# The Koda Creative Stack — CLAUDE.md y Identidad Creativa

## Propósito
Sistema para configurar la identidad creativa de Tim Koda dentro de Claude Code mediante el archivo CLAUDE.md. Este archivo define voz, identidad visual, formato de contenido y restricciones de lenguaje para que Claude Code produzca contenido consistente en cada sesión. Incluye el repositorio oficial con skills preconstruidas.

## Conceptos Clave
- **CLAUDE.md** — archivo de configuración que persiste la identidad creativa entre sesiones de Claude Code
- **Koda Stack** — repositorio Git con skills y configuraciones prebuilt para el flujo de Tim Koda
- **Skills (`~/.claude/skills/`)** — capacidades reutilizables que Claude Code carga automáticamente
- **Brand Voice** — tono bold/directo, casual pero experto; evita "game-changing", "unleash", "dive in"
- **Visual Identity** — colores primarios #FF2D8A y #FFF466, estilo editorial, humano
- **Content Format** — Instagram Reels, 30-40 segundos, estructura: hook → walkthrough → CTA

## Plataformas y APIs
- GitHub (`github.com/timkoda/koda-stack`)
- Claude Code (cualquier plan)

## Bloques de Código
- `Scripts_Automatizacion/install_koda_stack.sh` — clona el repositorio oficial Koda Stack en `~/.claude/skills/`
- `Scripts_Automatizacion/claude_md_template.txt` — plantilla de CLAUDE.md con voz, identidad y formato de contenido de Tim Koda
