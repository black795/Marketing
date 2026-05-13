# AI UGC Agency Guide — Agente de Agencia con Arcads AI

## Propósito
Guía para construir una agencia de UGC completamente automatizada usando Claude Code como operador y Arcads AI como generador de actores IA. El agente conecta con la API de Arcads, mantiene una base de conocimiento de hooks virales, escribe variaciones de anuncios y rastreasresultados de campaña.

## Conceptos Clave
- **Arcads AI** — plataforma que genera videos UGC realistas con actores IA controlables por API
- **Agente operador UGC** — Claude Code actúa como un empleado de agencia de publicidad
- **5 hook patterns** — patrones de apertura viral para anuncios UGC
- **Knowledge base en repo** — Claude Code construye y mantiene una biblioteca de hooks que funcionan
- **Seguimiento de variaciones** — el agente rastrea qué variantes de anuncio tienen mejor desempeño

## Plataformas y APIs
- Arcads AI (API key requerida)
- Claude Code
- Sistemas de análisis de ads (Meta Ads, TikTok Ads)

## Bloques de Código
- `Scripts_Automatizacion/ugc_agency_mega_prompt.txt` — mega-prompt para Claude Code que configura el agente operador de agencia UGC con Arcads AI
- `Scripts_Automatizacion/arcads_script_template.txt` — plantilla de script de 25 segundos para anuncios UGC (Hook + Value + Proof + CTA)
