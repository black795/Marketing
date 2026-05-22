/**
 * Logger de depuración del frontend.
 *
 * Silencioso por defecto. Se activa con NEXT_PUBLIC_DEBUG=1 en
 * frontend/.env.local. Sirve para rastrear, sin ensuciar la consola en
 * producción:
 *   - ciclo de vida de componentes React (mount / unmount / StrictMode)
 *   - creación / disparo de AbortController
 *   - apertura / cierre / eventos de streams SSE
 *   - cancelaciones REALES (el usuario pulsó cancelar) vs ACCIDENTALES
 *     (un rerender o un remount abortó el fetch sin querer)
 *
 * Todas las funciones son no-op cuando el flag está apagado, así que
 * llamarlas en caliente no tiene coste perceptible.
 */

const DEBUG =
  process.env.NEXT_PUBLIC_DEBUG === '1' ||
  process.env.NEXT_PUBLIC_DEBUG === 'true';

/** true cuando el logging de depuración está activo. */
export const debugEnabled = DEBUG;

function stamp(): string {
  // HH:MM:SS.mmm — suficiente para ordenar eventos dentro de una sesión.
  return new Date().toISOString().slice(11, 23);
}

export function dlog(scope: string, message: string, data?: unknown): void {
  if (!DEBUG) return;
  const prefix = `%c[${stamp()}] [${scope}]%c ${message}`;
  if (data !== undefined) {
    console.log(prefix, 'color:#FF2D8A;font-weight:bold', 'color:inherit', data);
  } else {
    console.log(prefix, 'color:#FF2D8A;font-weight:bold', 'color:inherit');
  }
}

export function dwarn(scope: string, message: string, data?: unknown): void {
  if (!DEBUG) return;
  if (data !== undefined) console.warn(`[${stamp()}] [${scope}] ${message}`, data);
  else console.warn(`[${stamp()}] [${scope}] ${message}`);
}

export function derror(scope: string, message: string, err?: unknown): void {
  if (!DEBUG) return;
  if (err !== undefined) console.error(`[${stamp()}] [${scope}] ${message}`, err);
  else console.error(`[${stamp()}] [${scope}] ${message}`);
}

/**
 * Engancha logging al ciclo de vida de un AbortSignal: registra cuándo se
 * dispara el abort y cuánto tiempo llevaba vivo. Clave para diagnosticar
 * abortos accidentales. Devuelve una función de limpieza.
 */
export function traceAbortSignal(signal: AbortSignal, label: string): () => void {
  if (!DEBUG) return () => {};
  const bornAt = Date.now();
  if (signal.aborted) {
    dwarn('abort', `${label}: el signal YA estaba abortado al engancharlo`);
    return () => {};
  }
  const onAbort = () => {
    dlog('abort', `${label}: AbortSignal disparado`, {
      vivoMs: Date.now() - bornAt,
      reason: (signal as { reason?: unknown }).reason,
    });
  };
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}
