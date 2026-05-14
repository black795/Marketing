# TIAAT — Tim Koda Creative OS

Pipeline de generación de historias visuales: prompt → guión cinematográfico
con escenas + imágenes → revisión en UI → export JSON. Listo como base para
agregar generación de video en una fase posterior.

> Estado: **MVP demo entregable** (Fase 5 completa).
> Próxima fase: integración Remotion / Higgsfield para video real.

---

## Arquitectura

Tres procesos, cada uno corre en su propio puerto:

```
┌──────────────┐     POST /api/      ┌──────────────┐     POST /         ┌─────────────────┐
│  Next.js     │   generate-story    │  Node /      │  generate-image    │  FastAPI worker │
│  frontend    │ ─────────────────▶  │  Express     │ ─────────────────▶ │  (Python)       │
│  :3000       │                     │  gateway     │                    │  :5000          │
└──────────────┘                     │  :4000       │                    └────────┬────────┘
                                     └──────┬───────┘                             │
                                            │                                     │
                                            ▼                                     ▼
                                   Anthropic Claude API                  Replicate API
                                   (storyEngine.ts                       (nano-banana-pro,
                                    devuelve scenes JSON)                 gpt-image-2)
```

| Proceso  | Carpeta            | Stack                  | Responsabilidad                                   |
| -------- | ------------------ | ---------------------- | ------------------------------------------------- |
| Frontend | `frontend/`        | Next.js 14, Tailwind   | Form de prompt + grid de escenas + timeline + export JSON |
| Gateway  | `backend/`         | Node, Express, dotenv  | Orquesta Claude (escenas) y worker (imágenes), retry en 429/502 |
| Worker   | `workers/python/`  | FastAPI, replicate-py  | Wrappea `/API/manager.py` por HTTP                |
| Modelos  | `API/`             | replicate Python SDK   | Adaptadores por modelo (`nano_banana_pro`, `gpt_image_2`) |

---

## Quickstart

### 1. Requisitos
- Node 18+
- Python 3.10+
- Cuenta Replicate con crédito (≥$5 USD recomendado, evita rate limit `burst=1`)
- API key de Anthropic Claude

### 2. Configurar secrets

Cada proceso lee su `.env` (ninguno se versiona).

`/.env` (raíz — usado por el worker Python vía `API/manager.py`):
```
REPLICATE_API_TOKEN=r8_...
```

`/backend/.env`:
```
PORT=4000
PYTHON_WORKER_URL=http://127.0.0.1:5000
ANTHROPIC_API_KEY=sk-ant-...
```

`/workers/python/.env` (opcional, valores default funcionan):
```
PYTHON_WORKER_PORT=5000
GATEWAY_ORIGIN=http://localhost:4000
```

### 3. Instalar

```powershell
# Backend gateway
cd backend; npm install

# Frontend
cd ../frontend; npm install

# Worker Python (crea venv una sola vez)
cd ../workers/python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4. Arrancar los 3 procesos (3 terminales)

```powershell
# Terminal 1 — Worker Python
cd workers/python
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 5000 --reload
```

```powershell
# Terminal 2 — Backend Node
cd backend
npm run dev
```

```powershell
# Terminal 3 — Frontend Next.js
cd frontend
npm run dev
```

Abrir http://localhost:3000.

### 5. Health check rápido

```powershell
curl http://127.0.0.1:5000/health
# → {"status":"ok","models":["gpt_image_2","nano_banana_pro"]}
```

---

## Cómo funciona una request

1. Usuario llena el form en el frontend y aprieta "Generar historia".
2. Frontend hace `POST /api/generate-story` al gateway.
3. Gateway llama a Claude con `STORY_MASTER_PROMPT` → recibe JSON con `title`, `style`, `characters[]`, `scenes[]`.
4. Gateway recorre escenas **en serie** y por cada una llama a `POST /generate-image` del worker Python.
5. Worker invoca `API/manager.run_model(...)` → Replicate genera la imagen.
6. Gateway agrega `image_url` (o `image_error`) a cada escena y responde al frontend.
7. Frontend renderiza grid, timeline y panel de detalle. El usuario puede exportar el JSON completo.

---

## Decisiones de diseño relevantes

- **Guardrail anti-IP en `STORY_MASTER_PROMPT`**: los `image_prompt` que viajan a Gemini/OpenAI no pueden nombrar personajes registrados ni personas reales (E005 de Google los rechaza). Claude anonimiza por descripción visual. Los campos textuales (`narration`, `scene_title`) sí mantienen los nombres originales.
- **Procesamiento secuencial + retry en 429**: cuentas de Replicate con crédito <$5 USD tienen `burst=1`. El gateway procesa una escena a la vez y reintenta hasta 3 veces con el delay que indica Replicate (`"in ~10s"`), parseado del payload.
- **Worker surfacea 429/402** como status real en vez de aplastar todo en 502 — permite al gateway distinguir entre throttling (reintentable) y errores de upstream (no).
- **`.claude/settings.local.json` no se versiona**: contiene config local de permisos de Claude Code y puede acumular secrets sin querer.

---

## Modelos disponibles

Configurables desde el dropdown del form:

| Wire name          | Replicate model         | Estado                  |
| ------------------ | ----------------------- | ----------------------- |
| `nano-banana-pro`  | `google/nano-banana-pro`| Listo                   |
| `chatgpt-image-2`  | `openai/gpt-image-1`    | Listo                   |
| `nano-banana-2`    | —                       | No implementado (501)   |

Para agregar un modelo nuevo:
1. Crear `API/<model>.py` con su función `generate(...)` y decorarla con `@register("nombre_logico")`.
2. Importarlo en `API/manager.py`.
3. Mapear `wire-name` → `nombre_logico` en `workers/python/app/routes/generate_image.py:MODEL_NAME_MAP`.
4. Si el modelo acepta imagen referencial, agregar la entrada en `REFERENCE_KW`.

---

## Estructura del repositorio

```
.
├── frontend/                Next.js 14 (App Router)
│   ├── app/page.tsx         Orquesta estados empty / loading / result
│   └── components/          PromptForm, ProjectHeader, ScenesGrid, SceneCard,
│                            SceneDetailPanel, TimelineStrip,
│                            ExportJsonButton, VideoPlaceholderButton
├── backend/                 Node gateway
│   ├── src/server.ts        Express bootstrap
│   ├── src/routes/          /api/generate-story
│   ├── src/services/        claude/storyEngine, python-worker/imageWorker
│   └── src/prompts/         STORY_MASTER_PROMPT con guardrail anti-IP
├── workers/python/          FastAPI worker
│   └── app/                 main, routes/generate_image, schemas
├── API/                     Adaptadores Replicate (manager + un archivo por modelo)
├── output/                  Imágenes/videos generados (gitignored)
└── CLAUDE.md                Contexto del Tim Koda Creative OS para Claude Code
```

---

## Troubleshooting

| Síntoma                                                     | Causa probable                                       | Fix                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Cards con `"fetch failed"`                                  | Worker Python no está corriendo                      | Levantar uvicorn en `:5000`                            |
| Cards con `Replicate ... E005 ... sensitive`                | El `image_prompt` mencionó IP/personas reales        | El guardrail debería evitarlo; si pasa, reformular prompt original |
| Cards con `429 ... rate limit ... burst of 1`               | Cuenta Replicate con <$5 crédito                     | Cargar crédito (rápido) o esperar — el retry cubre igual |
| `[generate-story] worker health check failed`               | Worker arrancó pero `:5000` no responde              | Reiniciar worker, ver logs del FastAPI                 |
| Generación toma 60-90s para 5 escenas                       | Es lo esperado con `burst=1` (1 escena cada ~12s)    | Cargar crédito para subir a paralelo                   |

---

## Próximos pasos (post-MVP)

- Conectar el botón "Generar video (próximamente)" a Remotion o Higgsfield.
- Permitir reordenar escenas con drag-and-drop.
- Edición inline de `image_prompt` por escena con regeneración individual.
- Persistencia de proyectos (DB).
- Autenticación.
