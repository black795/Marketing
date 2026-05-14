# Tim Koda — Python Image Worker

FastAPI microservice that wraps `/API/manager.py` over HTTP so the Node gateway
can request image generations without speaking Python.

## Setup

```powershell
cd workers\python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --reload --port 5000
```

The worker reads `REPLICATE_API_TOKEN` from the project root `.env` via
`API.manager` (no separate config needed).

## Endpoints

- `GET /health` — returns `{ status, models }` with the list of registered
  models exposed by `API.manager.available_models()`.
- `POST /generate-image` — body `{ model, prompt, reference_image_url?, aspect_ratio? }`,
  returns `{ image_url, model }`.

Wire-name → registered-name map:

| Wire name | Python registered name | Status |
|---|---|---|
| `nano-banana-pro` | `nano_banana_pro` | OK |
| `chatgpt-image-2` | `gpt_image_2` | OK |
| `nano-banana-2` | — | 501 (not implemented yet) |
