# INDICE DE AUTOMATIZACIÓN — Tim Koda Skills
> Todos los scripts, prompts y plantillas extraídos de las 54 páginas de Notion

| Nombre del Script | Ruta | Lenguaje/Formato | Propósito del Flujo | Curso de Origen |
|---|---|---|---|---|
| `install_claude_code_mac.sh` | `Scripts_Automatizacion/install_claude_code_mac.sh` | Bash | Instalar Claude Code + fal.ai + Remotion + Notion MCP en Mac | Claude Code Creative Pipeline Starter |
| `install_claude_code_windows.ps1` | `Scripts_Automatizacion/install_claude_code_windows.ps1` | PowerShell | Instalar Claude Code en Windows con un comando | Claude Code UGC System |
| `install_higgsfield_agents.sh` | `Scripts_Automatizacion/install_higgsfield_agents.sh` | Bash | Instalar Playwright MCP + skills Higgsfield/Seedance en Claude Code | Creative Autopilot System — Higgsfield |
| `install_resolve_mcp.sh` | `Scripts_Automatizacion/install_resolve_mcp.sh` | Bash | Conectar Claude Code con DaVinci Resolve vía MCP (215 funciones) | Claude Resolve Stack — DaVinci |
| `install_koda_stack.sh` | `Scripts_Automatizacion/install_koda_stack.sh` | Bash | Clonar repositorio oficial Koda Stack en ~/.claude/skills/ | The Koda Creative Stack |
| `remotion_render.sh` | `Scripts_Automatizacion/remotion_render.sh` | Bash | Renderizar y previsualizar videos con Remotion | Claude Code Creative Pipeline Starter |
| `claude_md_template.txt` | `Scripts_Automatizacion/claude_md_template.txt` | Texto/Config | Plantilla CLAUDE.md con identidad creativa de Tim Koda | The Koda Creative Stack |
| `ugc_agency_mega_prompt.txt` | `Scripts_Automatizacion/ugc_agency_mega_prompt.txt` | Prompt/Texto | Mega-prompt para agente Claude Code operador de agencia UGC con Arcads AI | AI UGC Agency Guide |
| `creative_director_agent_prompt.txt` | `Scripts_Automatizacion/creative_director_agent_prompt.txt` | Prompt/Texto | System prompt del Agente Director Creativo (idea → concepto de Reel) | 3 Claude Code Creative Agents |
| `content_machine_agent_prompt.txt` | `Scripts_Automatizacion/content_machine_agent_prompt.txt` | Prompt/Texto | System prompt del Agente de Producción Visual (1 imagen → campaña de 5) | 3 Claude Code Creative Agents |
| `repurposer_agent_prompt.txt` | `Scripts_Automatizacion/repurposer_agent_prompt.txt` | Prompt/Texto | System prompt del Agente de Repurposing (Reel → Carrusel + Thread + LinkedIn + Stories) | 3 Claude Code Creative Agents |
| `krea_motion_setup_prompt.txt` | `Scripts_Automatizacion/krea_motion_setup_prompt.txt` | Prompt/Texto | Prompt para Claude Code que auto-genera el script Python de integración Krea API | AI Motion Design System — Krea |
| `krea_node_agent_build_prompt.txt` | `Scripts_Automatizacion/krea_node_agent_build_prompt.txt` | Prompt/Texto | Prompt para Node Agent de Krea — construye workflow 3D motion design automáticamente | AI Motion Design System — Krea |
| `krea_3d_character_prompt.txt` | `Scripts_Automatizacion/krea_3d_character_prompt.txt` | Prompt/Texto | Prompt del Nodo 1 de Krea — imagen → personaje vinilo 3D | AI Motion Design System — Krea |
| `krea_motion_video_prompt.txt` | `Scripts_Automatizacion/krea_motion_video_prompt.txt` | Prompt/Texto | Prompt del Nodo 2 de Krea — personaje 3D → video de motion design animado | AI Motion Design System — Krea |
| `krea_8_motion_prompts.txt` | `Scripts_Automatizacion/krea_8_motion_prompts.txt` | Prompt/Texto | 8 prompts de motion design para Kling/Seedance (Bounce, Spin, Wink, etc.) | AI Motion Design System — Krea |
| `seedance_6layer_master_template.txt` | `Scripts_Automatizacion/seedance_6layer_master_template.txt` | Prompt/Texto | Plantilla maestra de 6 capas para Seedance 2.0 con constraints positivos y palabras prohibidas | Seedance 2.0 Master Guide |
| `seedance_multishot_bracket_example.txt` | `Scripts_Automatizacion/seedance_multishot_bracket_example.txt` | Prompt/Texto | Ejemplo verificado de 3 planos con bracket syntax de Seedance 2.0 | Seedance 2.0 Master Guide |
| `seedance_audio_prompting_dictionary.txt` | `Scripts_Automatizacion/seedance_audio_prompting_dictionary.txt` | Prompt/Texto | Diccionario de audio para Seedance 2.0: voz, SFX, música, acústica | Seedance 2.0 Master Guide |
| `multi_angle_system_prompt_llm.txt` | `Scripts_Automatizacion/multi_angle_system_prompt_llm.txt` | Prompt/Texto | System prompt para LLM que genera prompts de Nano Banana Pro (9 ángulos) | MULTI-ANGLE WORKFLOW |
| `multi_angle_nano_banana_universal_prompt.txt` | `Scripts_Automatizacion/multi_angle_nano_banana_universal_prompt.txt` | Prompt/Texto | Prompt universal para Nano Banana Pro — grid 3x3 con 9 composiciones distintas | MULTI-ANGLE WORKFLOW |
| `infinite_loop_json_prompt.json` | `Scripts_Automatizacion/infinite_loop_json_prompt.json` | JSON | JSON completo para InVideo/Nano Banana — bloquea todos los parámetros visuales del Infinite Loop | Infinite Loop Effect Guide |
| `infinite_loop_kling_tracking_prompt.txt` | `Scripts_Automatizacion/infinite_loop_kling_tracking_prompt.txt` | Prompt/Texto | Prompt de tracking shot para Kling 2.5 — idéntico para todos los clips del loop | Infinite Loop Effect Guide |
| `visual_contrast_formula_prompt.txt` | `Scripts_Automatizacion/visual_contrast_formula_prompt.txt` | Prompt/Texto | Fórmula de prompt para colisiones visuales imposibles (scroll-stop) con Recraft V4 | AI Creation Master Guide |
| `cinematic_aesthetic_scene_prompt.txt` | `Scripts_Automatizacion/cinematic_aesthetic_scene_prompt.txt` | Prompt/Texto | Estructura de prompt para replicar estética cinematográfica de película en TapNow AI | Cinematic Aesthetic Workflow |
| `makeugc_6scene_storyboard_prompt.txt` | `Scripts_Automatizacion/makeugc_6scene_storyboard_prompt.txt` | Prompt/Texto | Mega-prompt para LLM que genera storyboard de 6 frames en JSON para MakeUGC | MakeUGC — Cinematic Ad Creation |
| `arcads_script_template.txt` | `Scripts_Automatizacion/arcads_script_template.txt` | Prompt/Texto | Plantilla de script UGC de 25 segundos (Hook + Value + Proof + CTA) + 5 hook patterns | Arcads AI Ultimate Guide + AI UGC Agency |
| `ugc_actor_consistency_portrait_prompt.txt` | `Scripts_Automatizacion/ugc_actor_consistency_portrait_prompt.txt` | Prompt/Texto | Prompt para generar foto de referencia de personaje UGC (selfie iPhone) con Nano Banana 2 | 5 Consistent UGC Actors |
| `ugc_scene_multi_actor_prompt.txt` | `Scripts_Automatizacion/ugc_scene_multi_actor_prompt.txt` | Prompt/Texto | Prompt para escenas UGC con hasta 5 actores IA simultáneos | 5 Consistent UGC Actors |
| `ugc_video_iphone_prompt.txt` | `Scripts_Automatizacion/ugc_video_iphone_prompt.txt` | Prompt/Texto | Prompt para animar actor UGC en video estilo cámara frontal iPhone (Kling/Higgsfield) | 5 Consistent UGC Actors |
| `character_dna_template.txt` | `Scripts_Automatizacion/character_dna_template.txt` | Plantilla/Texto | Plantilla completa de Character DNA para documentar y mantener consistencia de personajes IA | Character DNA System |
| `ai_influencer_realism_keywords.txt` | `Scripts_Automatizacion/ai_influencer_realism_keywords.txt` | Prompt/Texto | Keywords de realism + iPhone trick + candidez para influencers IA fotorrealistas | AI Influencer Blueprint |
| `realism_formula_skin_prompt.json` | `Scripts_Automatizacion/realism_formula_skin_prompt.json` | JSON | JSON prompt para Gemini 2.5 Flash Image — texturas de piel ultra-realistas | THE REALISM FORMULA |
| `humanify_texture_prompt.txt` | `Scripts_Automatizacion/humanify_texture_prompt.txt` | Prompt/Texto | Prompt de imperfecciones orgánicas — añadir al final de cualquier prompt para que no parezca IA | The Humanify System |
| `7_cinematic_camera_angles_prompts.txt` | `Scripts_Automatizacion/7_cinematic_camera_angles_prompts.txt` | Prompt/Texto | 7 prompts de ángulos cinematográficos (Vignette, Top Down, Fisheye, High Angle, Bird's Eye, Bag POV, Box POV) | 7 Cinematic Camera Angles |
| `tapnow_product_shoot_llm_prompt.txt` | `Scripts_Automatizacion/tapnow_product_shoot_llm_prompt.txt` | Prompt/Texto | Mega-prompt Creative Director para LLM — genera 7 prompts de campaña editorial de producto en JSON | TapNow Product Shoot |
| `product_360_packshot_json_prompt.json` | `Scripts_Automatizacion/product_360_packshot_json_prompt.json` | JSON | JSON para Gemini 2.5 Flash Image — 24 vistas turntable 360° + product sheet 6x4 | How to Handle Impossible Product Shots |
| `best_way_to_prompt_template.txt` | `Scripts_Automatizacion/best_way_to_prompt_template.txt` | Plantilla/Texto | Plantilla de 8 componentes del prompt cinematográfico con ejemplo verificado | THE BEST WAY TO PROMPT |
| `multi_prompting_master_template.txt` | `Scripts_Automatizacion/multi_prompting_master_template.txt` | Plantilla/Texto | Estructura de master prompt para consistencia visual en sesiones multi-shot | MULTI PROMPTING SYSTEM |
| `master_visual_intent_framework.txt` | `Scripts_Automatizacion/master_visual_intent_framework.txt` | Framework/Texto | Framework de 3 pasos (Feeling → References → Elements) para definir intención visual antes del prompt | Master Visual Intent Framework |
| `prompt_design_word_database.txt` | `Scripts_Automatizacion/prompt_design_word_database.txt` | Base de datos/Texto | 200 keywords en 10 categorías para enriquecer prompts (Architecture, Lighting, Mood, Texture, etc.) | Prompt Design Word Database |
| `7_cinematic_lighting_setups_prompts.txt` | `Scripts_Automatizacion/7_cinematic_lighting_setups_prompts.txt` | Prompt/Texto | 7 prompts completos de iluminación cinematográfica (Golden Hour, Low Key, Spotlight, Chiaroscuro, Cutter, Flash, Silhouette) | 7 Cinematic Lighting Setups |
| `emotional_branding_structure_prompt.txt` | `Scripts_Automatizacion/emotional_branding_structure_prompt.txt` | Prompt/Texto | Prompt 1: define el DNA emocional de la marca (emoción en 3s, enemigo, personalidad) | The Emotional Branding System |
| `emotional_branding_visual_direction_prompt.txt` | `Scripts_Automatizacion/emotional_branding_visual_direction_prompt.txt` | Prompt/Texto | Prompt 2: traduce el DNA emocional a tipografía, colores hex, texturas, fotografía | The Emotional Branding System |
| `emotional_branding_asset_generation_prompt.txt` | `Scripts_Automatizacion/emotional_branding_asset_generation_prompt.txt` | Prompt/Texto | Prompt 3: genera 5 assets (logo, mascota, packaging, stickers, template IG) con textura orgánica | The Emotional Branding System |
| `emotional_branding_texture_keywords.txt` | `Scripts_Automatizacion/emotional_branding_texture_keywords.txt` | Prompt/Texto | Biblioteca de keywords para assets de marca que parecen hechos a mano (chalk, ink bleed, paper grain) | The Emotional Branding System |
| `emergent_stack_site_brief_template.txt` | `Scripts_Automatizacion/emergent_stack_site_brief_template.txt` | Plantilla/Texto | Template de brief de marca para Emergent.sh — genera sitio Next.js completo con hosting | The Emergent Stack |

---

## Resumen por Categoría

| Categoría | Scripts | Descripción |
|---|---|---|
| Instalación / Setup | 5 | install_claude_code_mac, windows, higgsfield, resolve, koda_stack |
| Agentes Claude Code | 6 | claude_md, ugc_agency, creative_director, content_machine, repurposer, remotion_render |
| Krea Motion Design | 5 | krea_motion_setup, node_agent, 3d_character, motion_video, 8_motion_prompts |
| Seedance 2.0 | 3 | 6layer_template, multishot_bracket, audio_dictionary |
| Multi-Ángulo | 2 | system_prompt_llm, nano_banana_universal |
| Infinite Loop | 2 | json_prompt, kling_tracking |
| Producción Video | 2 | visual_contrast_formula, cinematic_aesthetic |
| UGC / Publicidad | 4 | makeugc_storyboard, arcads_script, ugc_actor_portrait, ugc_scene_multi |
| Video UGC | 1 | ugc_video_iphone |
| Personajes / Avatares | 2 | character_dna, ai_influencer_realism |
| Imagen / Realismo | 3 | realism_formula_skin, humanify, 7_camera_angles |
| Fotografía Producto | 2 | tapnow_product_shoot, product_360_packshot |
| Prompting / Frameworks | 4 | best_way_to_prompt, multi_prompting, master_visual_intent, word_database |
| Iluminación | 1 | 7_cinematic_lighting_setups |
| Branding Emocional | 4 | branding_structure, visual_direction, asset_generation, texture_keywords |
| Marca / Web | 1 | emergent_stack_brief |

**Total: 47 archivos de script/prompt**
