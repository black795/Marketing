/**
 * Configuración persistente del subsistema de captions.
 *
 * Se guarda en `backend/.config/captions.json` (gitignored). Contiene el
 * proveedor activo, el modo, y por proveedor su estado + API key.
 *
 * La API key se resuelve con esta prioridad:
 *   1. La guardada vía UI (store JSON).
 *   2. La variable de entorno de fallback (CAPTIONS_AI_API_KEY, etc.).
 * Así un despliegue puede inyectar la key por env sin tocar la UI.
 */
import { readJsonConfig, writeJsonConfig, maskSecret } from '../secrets';

export type CaptionsMode = 'auto' | 'manual';

export interface ProviderConfig {
  enabled: boolean;
  /** API key en texto plano. Solo vive en el backend. '' = usar env. */
  apiKey: string;
}

export interface CaptionsConfig {
  /** id del proveedor activo (debe existir en el registry). */
  activeProvider: string;
  /** Captions activadas globalmente. */
  captionsEnabled: boolean;
  /** 'auto' = el sistema decide; 'manual' = control explícito del usuario. */
  mode: CaptionsMode;
  /** Si el proveedor activo falla, intentar el siguiente habilitado. */
  fallbackEnabled: boolean;
  /** Estado por proveedor, indexado por id. */
  providers: Record<string, ProviderConfig>;
}

/** Variable de entorno de fallback por proveedor. */
const ENV_KEY_BY_PROVIDER: Record<string, string> = {
  'captions-ai': 'CAPTIONS_AI_API_KEY',
  submagic: 'SUBMAGIC_API_KEY',
  capsubs: 'CAPSUBS_API_KEY',
};

const DEFAULT_CONFIG: CaptionsConfig = {
  activeProvider: 'captions-ai',
  captionsEnabled: true,
  mode: 'auto',
  fallbackEnabled: true,
  providers: {},
};

const CONFIG_NAME = 'captions';

export function getCaptionsConfig(): CaptionsConfig {
  const cfg = readJsonConfig<CaptionsConfig>(CONFIG_NAME, DEFAULT_CONFIG);
  // Garantiza que `providers` siempre sea un objeto.
  if (!cfg.providers || typeof cfg.providers !== 'object') {
    cfg.providers = {};
  }
  return cfg;
}

/** Aplica un patch parcial a la config global (sin tocar las keys). */
export function updateCaptionsConfig(
  patch: Partial<Omit<CaptionsConfig, 'providers'>>
): CaptionsConfig {
  const cfg = getCaptionsConfig();
  const next: CaptionsConfig = {
    ...cfg,
    ...patch,
    providers: cfg.providers,
  };
  writeJsonConfig(CONFIG_NAME, next);
  return next;
}

export function getProviderConfig(id: string): ProviderConfig {
  const cfg = getCaptionsConfig();
  return cfg.providers[id] ?? { enabled: false, apiKey: '' };
}

/** Guarda la API key de un proveedor y lo marca como habilitado. */
export function setProviderKey(id: string, apiKey: string): void {
  const cfg = getCaptionsConfig();
  cfg.providers[id] = {
    enabled: true,
    apiKey: apiKey.trim(),
  };
  writeJsonConfig(CONFIG_NAME, cfg);
}

/** Borra la API key de un proveedor (vuelve a depender del env, si hay). */
export function clearProviderKey(id: string): void {
  const cfg = getCaptionsConfig();
  if (cfg.providers[id]) {
    cfg.providers[id] = { ...cfg.providers[id], apiKey: '' };
    writeJsonConfig(CONFIG_NAME, cfg);
  }
}

export function setProviderEnabled(id: string, enabled: boolean): void {
  const cfg = getCaptionsConfig();
  cfg.providers[id] = {
    enabled,
    apiKey: cfg.providers[id]?.apiKey ?? '',
  };
  writeJsonConfig(CONFIG_NAME, cfg);
}

/**
 * Resuelve la API key efectiva de un proveedor: primero el store, luego la
 * variable de entorno de fallback. Devuelve null si no hay ninguna.
 */
export function resolveProviderKey(id: string): string | null {
  const stored = getProviderConfig(id).apiKey;
  if (stored) return stored;
  const envName = ENV_KEY_BY_PROVIDER[id];
  const envValue = envName ? (process.env[envName] || '').trim() : '';
  return envValue || null;
}

/** De dónde viene la key efectiva — para mostrarlo en la UI. */
export function describeProviderKey(id: string): {
  hasKey: boolean;
  maskedKey: string;
  source: 'store' | 'env' | 'none';
} {
  const stored = getProviderConfig(id).apiKey;
  if (stored) {
    return { hasKey: true, maskedKey: maskSecret(stored), source: 'store' };
  }
  const envName = ENV_KEY_BY_PROVIDER[id];
  const envValue = envName ? (process.env[envName] || '').trim() : '';
  if (envValue) {
    return { hasKey: true, maskedKey: maskSecret(envValue), source: 'env' };
  }
  return { hasKey: false, maskedKey: '', source: 'none' };
}
