/**
 * Manejo seguro de secretos del gateway.
 *
 * Reglas de oro:
 *   - Los secretos (API keys) viven SOLO en el backend: en variables de
 *     entorno o en `backend/.config/` (gitignored). Nunca se exponen al
 *     frontend ni se imprimen completos en logs.
 *   - El frontend solo recibe versiones enmascaradas (`maskSecret`).
 *
 * Este módulo provee:
 *   - `maskSecret`     — enmascara un secreto para mostrarlo/loguearlo.
 *   - `readJsonConfig` / `writeJsonConfig` — store JSON en backend/.config/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from './logger';

const log = createLogger('secrets');

/**
 * Directorio de configuración runtime del backend. Está en .gitignore:
 * aquí se guardan las API keys ingresadas desde la UI. NO subir al repo.
 */
export const CONFIG_DIR = path.resolve(__dirname, '..', '..', '.config');

/**
 * Enmascara un secreto dejando visibles solo los últimos 4 caracteres.
 * Ej: "r8_abcdef1234" → "••••••1234". Cadenas cortas se ocultan del todo.
 * Úsalo SIEMPRE antes de loguear o devolver una key al cliente.
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return '••••••' + trimmed.slice(-4);
}

/** Sanitiza un objeto para logging: enmascara claves que parezcan secretos. */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const SECRET_KEYS = /(api[_-]?key|token|secret|password|authorization)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SECRET_KEYS.test(k) && typeof v === 'string' ? maskSecret(v) : v;
  }
  return out;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/** Lee un JSON de backend/.config/<name>.json. Devuelve `fallback` si no existe. */
export function readJsonConfig<T>(name: string, fallback: T): T {
  try {
    const file = path.join(CONFIG_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch (err) {
    log.error(`no se pudo leer la config "${name}", usando defaults`, undefined, err);
    return fallback;
  }
}

/** Escribe un JSON en backend/.config/<name>.json con permisos restrictivos. */
export function writeJsonConfig(name: string, data: unknown): void {
  ensureConfigDir();
  const file = path.join(CONFIG_DIR, `${name}.json`);
  // mode 0o600 = solo el dueño puede leer/escribir (efectivo en POSIX).
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}
