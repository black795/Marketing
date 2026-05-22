import type { Response } from 'express';
import { createLogger, type LogContext } from './logger';
import { metrics } from './metrics';

const log = createLogger('sse');

export interface SseEvent {
  event: string;
  data: unknown;
}

export interface SseStreamOptions {
  /** Etiqueta del endpoint, para correlación en logs (p. ej. "regenerate-images"). */
  label?: string;
  /** Contexto de logging (requestId, jobId, …) propagado a los logs del stream. */
  context?: LogContext;
  /**
   * Se dispara SOLO cuando el cliente abandona de verdad la conexión antes
   * de que el servidor termine la respuesta. Aquí es donde la ruta debe
   * llamar a `abort.abort()`.
   */
  onClientDisconnect?: () => void;
}

export interface SseStream {
  send: (e: SseEvent) => void;
  close: () => void;
  /** true cuando el cliente cerró la conexión antes de tiempo (desconexión real). */
  isClientGone: () => boolean;
}

/**
 * Abre un stream Server-Sent Events sobre la respuesta Express.
 *
 * ┌─ CORRECCIÓN DE LA CAUSA RAÍZ ────────────────────────────────────────┐
 * │ Antes cada ruta hacía:                                               │
 * │                                                                      │
 * │     req.on('close', () => { if (!res.writableEnded) abort.abort() }) │
 * │                                                                      │
 * │ En Node.js el evento 'close' del *request* (IncomingMessage) NO      │
 * │ significa "el cliente se desconectó". Se emite también —y sobre      │
 * │ todo— cuando el BODY del POST termina de leerse/consumirse, aunque   │
 * │ la respuesta SSE siga perfectamente viva.                            │
 * │                                                                      │
 * │ En /regenerate-images el body se consume al instante (no hay un      │
 * │ `await` previo como el health-check de la ruta de generación), así   │
 * │ que `req`'close llegaba en el mismo tick en que se registraba el     │
 * │ listener → abortaba la primera imagen → "cancelled by client".       │
 * │                                                                      │
 * │ El evento correcto es `res.on('close')`: solo se dispara cuando la   │
 * │ RESPUESTA termina. Distinguimos los dos casos con `writableEnded`:   │
 * │   - writableEnded === true  → la cerramos nosotros (fin normal)      │
 * │   - writableEnded === false → el socket se cayó (desconexión real)   │
 * │                                                                      │
 * │ Nota: el frontend usa `fetch` + streaming, NO `EventSource`. Un      │
 * │ `fetch` abortado no se reconecta solo, por lo que un `res`'close     │
 * │ con !writableEnded es siempre una cancelación real, nunca temporal.  │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export function openSseStream(res: Response, options: SseStreamOptions = {}): SseStream {
  const { label = 'sse', context, onClientDisconnect } = options;
  const streamLog = context ? log.child(context) : log;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Comentario inicial para que algunos proxies abran el stream de inmediato.
  res.write(`: stream open\n\n`);

  metrics.sseStreamsOpened += 1;
  metrics.sseStreamsActive += 1;

  let closed = false; // true cuando NOSOTROS cerramos el stream (fin normal)
  let clientGone = false; // true cuando el cliente se desconectó de verdad

  const startedAt = Date.now();
  streamLog.info(`stream abierto (${label})`);

  // Keep-alive: ping cada 15s para que proxies/balanceadores no maten la
  // conexión por inactividad durante generaciones largas.
  const keepAlive = setInterval(() => {
    if (closed || clientGone) return;
    try {
      res.write(`: ping\n\n`);
    } catch {
      /* el socket ya no acepta escrituras; onResClose se encargará */
    }
  }, 15_000);

  /**
   * Detección de desconexión REAL del cliente. Ver el bloque de arriba:
   * escuchamos `res` (la respuesta), no `req` (el request).
   */
  const onResClose = (): void => {
    if (closed) return; // lo cerramos nosotros → fin normal, no es desconexión
    if (res.writableEnded) return; // la respuesta se completó correctamente
    if (clientGone) return; // ya procesado

    clientGone = true;
    metrics.sseClientDisconnects += 1;
    streamLog.warn(
      `cliente desconectado realmente tras ${Date.now() - startedAt}ms (${label})`
    );
    try {
      onClientDisconnect?.();
    } catch (err) {
      streamLog.error('onClientDisconnect lanzó una excepción', undefined, err);
    }
  };
  res.on('close', onResClose);

  // Caso límite: si el socket ya estaba muerto antes de registrar el listener.
  if (res.destroyed && !res.writableEnded) {
    onResClose();
  }

  function send(e: SseEvent): void {
    // No escribimos si ya cerramos o si el cliente se fue: evita errores
    // "write after end" / "EPIPE" y ruido en logs.
    if (closed || clientGone) return;
    try {
      res.write(`event: ${e.event}\n`);
      res.write(`data: ${JSON.stringify(e.data)}\n\n`);
    } catch (err) {
      streamLog.error(`fallo escribiendo el evento "${e.event}"`, undefined, err);
    }
  }

  function close(): void {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    res.off('close', onResClose);
    metrics.sseStreamsActive = Math.max(0, metrics.sseStreamsActive - 1);
    streamLog.info(
      `stream cerrado (${label}) clientGone=${clientGone} duración=${Date.now() - startedAt}ms`
    );
    try {
      res.end();
    } catch {
      /* ignore — la conexión ya pudo haberse cerrado */
    }
  }

  return { send, close, isClientGone: () => clientGone };
}
