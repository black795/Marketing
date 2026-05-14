"""
Verifica que cada API key en keys.env esté activa y funcionando.
Ejecutar: python API/verify_keys.py
"""
import os
from pathlib import Path

KEYS_FILE = Path(__file__).parent / "keys.env"

# Cargar variables del archivo keys.env
if KEYS_FILE.exists():
    for line in KEYS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

results = []

# ── Replicate ─────────────────────────────────────────────────────────────────
def check_replicate():
    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        return "REPLICATE_API_TOKEN", "NO CONFIGURADA", False
    try:
        import replicate
        model = replicate.models.get("black-forest-labs/flux-schnell")
        return "REPLICATE_API_TOKEN", f"OK — {model.name}", True
    except Exception as e:
        return "REPLICATE_API_TOKEN", f"ERROR: {e}", False

# ── OpenAI (si existe) ────────────────────────────────────────────────────────
def check_openai():
    token = os.environ.get("OPENAI_API_KEY")
    if not token:
        return "OPENAI_API_KEY", "no configurada", None
    try:
        import openai
        client = openai.OpenAI(api_key=token)
        client.models.list()
        return "OPENAI_API_KEY", "OK", True
    except ImportError:
        return "OPENAI_API_KEY", "pip install openai requerido", False
    except Exception as e:
        return "OPENAI_API_KEY", f"ERROR: {e}", False

# ── Anthropic (si existe) ─────────────────────────────────────────────────────
def check_anthropic():
    token = os.environ.get("ANTHROPIC_API_KEY")
    if not token:
        return "ANTHROPIC_API_KEY", "no configurada", None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=token)
        client.models.list()
        return "ANTHROPIC_API_KEY", "OK", True
    except ImportError:
        return "ANTHROPIC_API_KEY", "pip install anthropic requerido", False
    except Exception as e:
        return "ANTHROPIC_API_KEY", f"ERROR: {e}", False

# ── ElevenLabs (si existe) ────────────────────────────────────────────────────
def check_elevenlabs():
    token = os.environ.get("ELEVENLABS_API_KEY")
    if not token:
        return "ELEVENLABS_API_KEY", "no configurada", None
    try:
        import httpx
        r = httpx.get("https://api.elevenlabs.io/v1/user", headers={"xi-api-key": token}, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return "ELEVENLABS_API_KEY", f"OK — {data.get('subscription', {}).get('tier', 'activa')}", True
        return "ELEVENLABS_API_KEY", f"ERROR {r.status_code}", False
    except Exception as e:
        return "ELEVENLABS_API_KEY", f"ERROR: {e}", False

# ── Run all checks ────────────────────────────────────────────────────────────
checks = [check_replicate, check_openai, check_anthropic, check_elevenlabs]

print("=" * 55)
print("  Tim Koda — Verificación de API Keys")
print("=" * 55)

for check in checks:
    name, status, ok = check()
    if ok is True:
        icon = "[OK]"
    elif ok is False:
        icon = "[FAIL]"
    else:
        icon = "[--]"
    print(f"  {icon:<6} {name:<25} {status}")

print("=" * 55)
