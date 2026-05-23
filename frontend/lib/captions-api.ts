/**
 * Cliente del subsistema de captions + timeline.
 *
 * Todas las llamadas van al gateway backend — el frontend NUNCA habla con
 * Captions AI directamente ni maneja API keys en claro.
 */
import type {
  CaptionConfig,
  CaptionMode,
  CaptionTestResult,
  CaptionTemplate,
  CaptionJobPhase,
  CaptionJobResult,
} from '@/types/captions';
import type { TimelineDocument } from '@/types/timeline';
import { parseSseStream, StreamCancelledError } from './api';
import { dlog, dwarn, derror, traceAbortSignal } from './debug-log';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

// ---- Configuración de captions --------------------------------------------

export async function getCaptionConfig(): Promise<CaptionConfig> {
  const res = await fetch(`${BACKEND_URL}/api/captions/config`);
  return jsonOrThrow<CaptionConfig>(res);
}

export async function updateCaptionConfig(patch: {
  activeProvider?: string;
  captionsEnabled?: boolean;
  mode?: CaptionMode;
  fallbackEnabled?: boolean;
}): Promise<CaptionConfig> {
  dlog('captions', 'actualizando config', patch);
  const res = await fetch(`${BACKEND_URL}/api/captions/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow<CaptionConfig>(res);
}

/** Guarda la API key de un proveedor. Devuelve solo la versión enmascarada. */
export async function saveProviderKey(
  providerId: string,
  apiKey: string
): Promise<{ maskedKey: string }> {
  dlog('captions', `guardando key de ${providerId}`);
  const res = await fetch(
    `${BACKEND_URL}/api/captions/${encodeURIComponent(providerId)}/key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    }
  );
  return jsonOrThrow<{ maskedKey: string }>(res);
}

export async function deleteProviderKey(providerId: string): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/captions/${encodeURIComponent(providerId)}/key`,
    { method: 'DELETE' }
  );
  await jsonOrThrow<unknown>(res);
}

export async function setProviderEnabled(
  providerId: string,
  enabled: boolean
): Promise<CaptionConfig> {
  const res = await fetch(
    `${BACKEND_URL}/api/captions/${encodeURIComponent(providerId)}/enabled`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }
  );
  return jsonOrThrow<CaptionConfig>(res);
}

/**
 * Prueba la conexión con un proveedor. Si se pasa `apiKey`, prueba esa key
 * (aún sin guardar); si no, usa la key guardada en el backend.
 */
export async function testProviderConnection(
  providerId: string,
  apiKey?: string
): Promise<CaptionTestResult> {
  dlog('captions', `probando conexión con ${providerId}`);
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/captions/${encodeURIComponent(providerId)}/test`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKey ? { apiKey } : {}),
      }
    );
    return await jsonOrThrow<CaptionTestResult>(res);
  } catch (err) {
    derror('captions', `fallo probando ${providerId}`, err);
    return {
      ok: false,
      status: 'error',
      detail: err instanceof Error ? err.message : 'Error de red',
    };
  }
}

// ---- Timeline compartido ---------------------------------------------------

export async function loadTimeline(
  projectId: string
): Promise<TimelineDocument | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/timeline/${encodeURIComponent(projectId)}`
  );
  if (res.status === 404) return null;
  const body = await jsonOrThrow<{ timeline: TimelineDocument }>(res);
  return body.timeline;
}

export interface BuildTimelinePayload {
  projectId: string;
  title?: string;
  fps?: number;
  width?: number;
  height?: number;
  source?: 'scripts' | 'avatar' | 'manual';
  audioUrl?: string | null;
  /** Si es true, las escenas se procesan en el orden recibido (custom). */
  respectOrder?: boolean;
  scenes: {
    scene_number: number;
    image_url?: string | null;
    video_url?: string | null;
    local_url?: string | null;
    duration?: number;
    narration?: string;
  }[];
}

export async function buildTimeline(
  payload: BuildTimelinePayload
): Promise<TimelineDocument> {
  const res = await fetch(`${BACKEND_URL}/api/timeline/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await jsonOrThrow<{ timeline: TimelineDocument }>(res);
  return body.timeline;
}

// ---- Captions Editor (fase 2) ---------------------------------------------

/** Lista las plantillas de estilo del proveedor de captions activo. */
export async function listCaptionTemplates(): Promise<CaptionTemplate[]> {
  const res = await fetch(`${BACKEND_URL}/api/captions/templates`);
  const body = await jsonOrThrow<{ templates: CaptionTemplate[] }>(res);
  return body.templates;
}

export interface CaptionJobCallbacks {
  onStart?: (info: { jobId: string; provider: string }) => void;
  onStatus?: (info: {
    phase: CaptionJobPhase;
    progress: number | null;
    message: string;
  }) => void;
  onWarning?: (message: string) => void;
}

export type CaptionJobOutcome =
  | { status: 'completed'; result: CaptionJobResult }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' };

/**
 * Envía un job de captioning vía SSE: el backend descarga el video, lo
 * manda al proveedor, polea el progreso y devuelve el video subtitulado.
 */
export async function streamCaptionJob(
  payload: { videoUrl: string; captionTemplateId: string },
  callbacks: CaptionJobCallbacks,
  signal: AbortSignal
): Promise<CaptionJobOutcome> {
  const startedAt = Date.now();
  const untrace = traceAbortSignal(signal, 'caption-job');
  dlog('captions', 'job: abriendo stream', payload);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/captions/job?stream=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    untrace();
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    derror('captions', 'job: fetch falló al conectar', err);
    throw err;
  }

  if (!response.ok || !response.body) {
    untrace();
    let detail = `Backend respondió ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail);
  }

  let outcome: CaptionJobOutcome = { status: 'cancelled' };
  let eventCount = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      eventCount += 1;
      dlog('captions', `job: evento "${event}"`, data);
      switch (event) {
        case 'start':
          callbacks.onStart?.({
            jobId: String(data?.jobId ?? ''),
            provider: String(data?.provider ?? ''),
          });
          break;
        case 'status':
          callbacks.onStatus?.({
            phase: (data?.phase as CaptionJobPhase) ?? 'processing',
            progress:
              typeof data?.progress === 'number' ? data.progress : null,
            message: String(data?.message ?? ''),
          });
          break;
        case 'warning':
          callbacks.onWarning?.(String(data?.message ?? ''));
          break;
        case 'done':
          outcome = {
            status: 'completed',
            result: {
              jobId: String(data?.jobId ?? ''),
              videoUrl: String(data?.video_url ?? ''),
              localUrl: data?.local_url ? String(data.local_url) : null,
            },
          };
          break;
        case 'error':
          outcome = {
            status: 'failed',
            error: String(data?.error ?? 'Generación de captions fallida'),
          };
          break;
        case 'cancelled':
          outcome = { status: 'cancelled' };
          break;
      }
    }
  } catch (err) {
    untrace();
    if ((err as { name?: string })?.name === 'AbortError') {
      dwarn('captions', 'job: stream abortado por el cliente');
      throw new StreamCancelledError();
    }
    derror('captions', 'job: el stream falló', err);
    throw err;
  }

  untrace();
  dlog('captions', `job: stream finalizado status=${outcome.status}`, {
    eventosRecibidos: eventCount,
    elapsedMs: Date.now() - startedAt,
  });
  return outcome;
}
