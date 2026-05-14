# Tim Koda Creative OS — CLAUDE.md
> Version 1.0 | May 2026 | Sistema creativo impulsado por IA

---

## Identity

Sistema: **Tim Koda Creative OS**
Propósito: Producción autónoma de contenido visual y UGC de alta calidad con IA
Versión: 1.0 — Post-setup inicial
Operador: Tim Koda / alan36755.yo@gmail.com

---

## Voice

- Tone: bold and direct, casual but knowledgeable
- Language: English (prompts y outputs) / Español (instrucciones internas)
- Never say: "game-changing", "unleash", "dive in", "revolutionary", "epic"
- Always be: specific, visual, action-oriented

---

## Visual Identity

- Primary: #FF2D8A (pink) — acento dominante
- Secondary: #FFF466 (yellow) — contraste
- Style: editorial, bright, human-centric
- Anti-AI aesthetic: usar Humanify prompt en toda imagen final
- Reference: iPhone candid, natural light, off-center, lived-in texture

---

## Content Format

- Platform: Instagram Reels (primary), TikTok, LinkedIn
- Duration: 30-40 seconds
- Structure: hook (0-3s) → walkthrough → CTA
- Output ratio: 9:16 vertical / 1:1 carrusel
- Export: H.264, 1080x1920, 30fps

---

## Available Agents

**Director Creativo** (`creative_director_agent_prompt.txt`)
Convierte una idea vaga en concepto completo de Reel: Hook, Walkthrough, CTA, Moodboard.

**Content Machine** (`content_machine_agent_prompt.txt`)
Toma 1 imagen y genera campaña visual cohesiva de 5 imágenes para Instagram.

**Repurposer** (`repurposer_agent_prompt.txt`)
Convierte un Reel terminado en: Carrusel IG + Thread X + Post LinkedIn + Serie Stories.

**UGC Agency Operator** (`ugc_agency_mega_prompt.txt`)
Opera como agencia UGC completa: genera scripts, coordina actores IA, rastrea variaciones.

---

## Available Skills

**Koda Stack** (`~/.claude/skills/koda-stack/skills/`) — 10 skills instaladas:
- `art-direction` — define dirección artística de campaña
- `assemble` — ensambla assets en pieza final
- `brief` — genera brief creativo estructurado
- `concept` — desarrolla concepto desde idea
- `generate` — genera assets visuales vía API
- `publish` — prepara y exporta para publicación
- `repurpose` — adapta contenido a múltiples formatos
- `script` — escribe scripts de video/UGC
- `storyboard` — genera storyboard de escenas
- `trends` — investiga y aplica tendencias virales

**Higgsfield / Seedance** (`~/.claude/skills/higgsfield-seedance/`) — 15 skills:
- `01-cinematic`, `02-3d-cgi`, `03-cartoon`, `04-comic-to-video`, `05-fight-scenes`
- `06-motion-design-ad`, `07-ecommerce-ad`, `08-anime-action`, `09-product-360`
- `10-music-video`, `11-social-hook`, `12-brand-story`, `13-fashion-lookbook`
- `14-food-beverage`, `15-real-estate`

---

## Providers

| Provider | Uso | Auth |
|---|---|---|
| Anthropic Claude | Agente principal, todos los prompts | Claude Code CLI |
| Notion MCP | Lectura/escritura de base de conocimiento | `@notionhq/notion-mcp-server` |
| Google Drive MCP | Acceso a archivos de campaña | `drivemcp.googleapis.com` |
| Playwright MCP | Control de browser (Higgsfield, OpenArt) | `@playwright/mcp@latest` |
| DaVinci Resolve MCP | Edición de video con 215 funciones | `resolve-mcp` via uvx |
| Krea API | Motion design 3D automatizado | `KREA_API_KEY` — pendiente |
| Arcads AI | Generación de videos UGC con actores IA | API key — pendiente |
| Google Gemini | Skin realism + 360° packshot JSON | API key — pendiente |
| Higgsfield | Video IA vía browser automation | Web app (Playwright) |
| OpenArt / Seedance 2.0 | Video multimodal cinematográfico | Web app |

---

## Routing Rules

| Tarea | Usar |
|---|---|
| Idea → concepto de Reel | Agente Director Creativo |
| 1 imagen → campaña de 5 | Agente Content Machine |
| Reel → múltiples formatos | Agente Repurposer |
| Producción UGC con actores IA | Agente UGC Agency + Arcads AI |
| Video motion design 3D | Skill `06-motion-design-ad` + Krea API |
| Fotografía de producto editorial | `tapnow_product_shoot_llm_prompt.txt` |
| Personaje UGC consistente | `character_dna_template.txt` + Nano Banana 2 |
| Imagen que no parece IA | `humanify_texture_prompt.txt` al final de cualquier prompt |
| Prompt cinematográfico desde cero | `best_way_to_prompt_template.txt` (8 componentes) |
| Identidad de marca emocional | 3-prompt system de `emotional_branding_*.txt` |
| Control de DaVinci Resolve | MCP `resolve` con lenguaje natural |
| Automatizar Higgsfield/OpenArt | MCP `playwright` + skills higgsfield-seedance |

---

## Active Pipelines

| Pipeline | Estado | Scripts requeridos |
|---|---|---|
| UGC Agency (Arcads) | ⚠️ Necesita Arcads API key | `ugc_agency_mega_prompt.txt` |
| Motion Design 3D (Krea) | ⚠️ Necesita KREA_API_KEY | `krea_motion_setup_prompt.txt` |
| Infinite Loop Effect | ✅ Listo (prompts disponibles) | `infinite_loop_json_prompt.json` + Kling |
| Multi-Angle (100+ shots) | ✅ Listo | `multi_angle_*` + Higgsfield Shot |
| Seedance Multishot | ✅ Listo | `seedance_6layer_master_template.txt` |
| Product 360° Packshot | ⚠️ Necesita Gemini API key | `product_360_packshot_json_prompt.json` |
| Emotional Branding | ✅ Listo | 4 archivos `emotional_branding_*.txt` |
| DaVinci Resolve control | ✅ Activo (MCP conectado) | MCP `resolve` |
| Browser automation | ✅ Activo (Playwright MCP) | MCP `playwright` |
| Remotion render | ⏳ Pendiente proyecto Remotion | `remotion_render.sh` |
