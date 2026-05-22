/**
 * Logger estructurado del gateway Tim Koda.
 *
 * Por qué existe
 * --------------
 * Antes el backend usaba `console.log` sueltos: sin timestamp, sin nivel y
 * sin correlación. Cuando la regeneración fallaba era imposible saber qué
 * request abortó a quién. Este logger añade, sin dependencias externas:
 *   - timestamp ISO
 *   - nivel filtrable (debug / info / warn / error)
 *   - scope (módulo) y contexto (requestId, jobId, sceneId, …)
 *   - colores en TTY, texto plano cuando la salida es un archivo o un pipe
 *   - stack traces completos en los errores
 *
 * Configuración (backend/.env)
 * ----------------------------
 *   LOG_LEVEL=debug|info|warn|error   → nivel mínimo a emitir (default: info)
 *   DEBUG=true                         → atajo equivalente a LOG_LEVEL=debug
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  if (/^(1|true|yes|on)$/i.test((process.env.DEBUG || '').trim())) return 'debug';
  return 'info';
}

const ACTIVE_LEVEL = resolveLevel();

/** true cuando LOG_LEVEL=debug (o DEBUG=true). Útil para gates baratos. */
export const debugEnabled = ACTIVE_LEVEL === 'debug';

// Colores solo si la salida es una terminal interactiva (no en archivos/CI).
const useColor = process.stdout.isTTY === true;
const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
} as const;

function paint(text: string, color: keyof typeof ANSI): string {
  return useColor ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

const LEVEL_TAG: Record<LogLevel, { label: string; color: keyof typeof ANSI }> = {
  debug: { label: 'DEBUG', color: 'gray' },
  info: { label: 'INFO ', color: 'cyan' },
  warn: { label: 'WARN ', color: 'yellow' },
  error: { label: 'ERROR', color: 'red' },
};

export interface LogContext {
  requestId?: string;
  jobId?: string;
  sceneId?: string | number;
  [key: string]: unknown;
}

function formatContext(ctx?: LogContext): string {
  if (!ctx) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(ctx)) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  return parts.length ? ' ' + paint(parts.join(' '), 'dim') : '';
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  ctx?: LogContext,
  err?: unknown
): void {
  // Filtro por nivel: lo más barato primero para no formatear de más.
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[ACTIVE_LEVEL]) return;

  const ts = paint(new Date().toISOString(), 'gray');
  const tag = LEVEL_TAG[level];
  const line =
    `${ts} ${paint(tag.label, tag.color)} ${paint(`[${scope}]`, 'magenta')} ` +
    `${message}${formatContext(ctx)}`;

  const sink =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line);

  // Los errores siempre arrastran su stack trace completo (y la causa, si la hay).
  if (err !== undefined) {
    if (err instanceof Error) {
      sink(paint(err.stack || `${err.name}: ${err.message}`, 'gray'));
      const cause = (err as { cause?: unknown }).cause;
      if (cause !== undefined) {
        sink(paint(`  cause: ${safeStringify(cause)}`, 'gray'));
      }
    } else {
      sink(paint(`  detail: ${safeStringify(err)}`, 'gray'));
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  /** `error(msg, ctx?, err?)` — `err` se imprime con stack trace completo. */
  error(message: string, ctx?: LogContext, err?: unknown): void;
  /** Devuelve un logger hijo con contexto fijo (p. ej. requestId). */
  child(boundCtx: LogContext): Logger;
}

/**
 * Crea un logger para un módulo. `bound` es contexto que se mezcla en cada
 * línea (lo usa `child` para fijar requestId/jobId y no repetirlos a mano).
 */
export function createLogger(scope: string, bound: LogContext = {}): Logger {
  const merge = (ctx?: LogContext): LogContext | undefined => {
    const hasBound = Object.keys(bound).length > 0;
    if (!ctx && !hasBound) return undefined;
    return { ...bound, ...(ctx || {}) };
  };
  return {
    debug: (m, ctx) => emit('debug', scope, m, merge(ctx)),
    info: (m, ctx) => emit('info', scope, m, merge(ctx)),
    warn: (m, ctx) => emit('warn', scope, m, merge(ctx)),
    error: (m, ctx, err) => emit('error', scope, m, merge(ctx), err),
    child: (childCtx) => createLogger(scope, { ...bound, ...childCtx }),
  };
}

/**
 * Genera un identificador corto y razonablemente único para correlación
 * (requestId / jobId). No es criptográfico — solo trazabilidad en logs.
 */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
