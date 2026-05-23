/**
 * Proveedor Captions AI (Mirage).
 *
 * API real verificada contra https://api.mirage.app/openapi.json:
 *   - Base URL: https://api.mirage.app   (override con CAPTIONS_AI_BASE_URL)
 *   - Auth: header `x-api-key`
 *   - GET  /v1/videos                         — lista videos (test de key)
 *   - GET  /v1/videos/captions/templates      — plantillas de estilo
 *   - POST /v1/videos/captions  (multipart)   — crea un job de captioning
 *   - GET  /v1/videos/{id}                    — estado + progreso del job
 *   - GET  /v1/videos/{id}/content            — descarga (redirect al CDN)
 *
 * Estados del job: PROCESSING | COMPLETE | FAILED | CANCELLED.
 */
import { createLogger } from '../../logger';
import type {
  CaptionsProvider,
  CaptionsTestResult,
  CaptionTemplate,
  CaptionJob,
  CaptionJobStatus,
  SubmitCaptionInput,
} from '../types';

const log = createLogger('captions:captions-ai');

const BASE_URL = (process.env.CAPTIONS_AI_BASE_URL || 'https://api.mirage.app').replace(
  /\/+$/,
  ''
);
const TEST_TIMEOUT_MS = 10_000;
const API_TIMEOUT_MS = 30_000;
const SUBMIT_TIMEOUT_MS = 120_000; // el upload del video puede ser pesado

/** Normaliza el estado de Mirage al estado interno del sistema. */
function mapStatus(raw: unknown): CaptionJobStatus {
  switch (String(raw || '').toUpperCase()) {
    case 'COMPLETE':
      return 'complete';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'processing';
  }
}

/** fetch con header x-api-key, timeout local y reenvío de un abort externo. */
async function apiFetch(
  path: string,
  apiKey: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'x-api-key': apiKey, ...(init.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Extrae un mensaje de error legible del cuerpo de una respuesta fallida. */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string };
      detail?: unknown;
    };
    if (body?.error?.message) return body.error.message;
    if (typeof body?.detail === 'string') return body.detail;
    if (body?.detail) return JSON.stringify(body.detail);
    return `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function mapJob(v: Record<string, any>, fallbackId = ''): CaptionJob {
  return {
    id: String(v.id ?? v.video_id ?? fallbackId),
    status: mapStatus(v.status),
    progress: typeof v.progress === 'number' ? v.progress : null,
    error:
      v.error && typeof v.error === 'object'
        ? String(v.error.message || v.error.code || 'Error de generación')
        : undefined,
  };
}

export const captionsAiProvider: CaptionsProvider = {
  info: {
    id: 'captions-ai',
    label: 'Captions AI (Mirage)',
    requiresApiKey: true,
    implemented: true,
    description:
      'Captioning con IA de Captions AI. Auto-subtítulos, word highlighting y estilos virales.',
  },

  // -------- Test de conexión (Fase 1) --------
  async testConnection(
    apiKey: string | null,
    signal?: AbortSignal
  ): Promise<CaptionsTestResult> {
    if (!apiKey) {
      return {
        ok: false,
        status: 'not_configured',
        detail: 'Falta la API key de Captions AI.',
      };
    }
    const startedAt = Date.now();
    try {
      const res = await apiFetch(
        '/v1/videos?limit=1',
        apiKey,
        { method: 'GET' },
        TEST_TIMEOUT_MS,
        signal
      );
      const latencyMs = Date.now() - startedAt;
      if (res.ok) {
        log.info(`test connection OK (${latencyMs}ms)`);
        return { ok: true, status: 'connected', detail: `Conectado a ${BASE_URL}`, latencyMs };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: 'invalid',
          detail: `API key rechazada por Captions AI (HTTP ${res.status}).`,
          latencyMs,
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          status: 'error',
          detail: 'Rate limit (HTTP 429). La key parece válida pero hay demasiadas requests.',
          latencyMs,
        };
      }
      return {
        ok: false,
        status: 'error',
        detail: `Respuesta inesperada de Captions AI: HTTP ${res.status}.`,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          ok: false,
          status: 'timeout',
          detail: `Timeout tras ${TEST_TIMEOUT_MS / 1000}s conectando a ${BASE_URL}.`,
          latencyMs,
        };
      }
      log.error('fallo en test connection', undefined, err);
      return {
        ok: false,
        status: 'error',
        detail: err instanceof Error ? err.message : 'Error de red desconocido',
        latencyMs,
      };
    }
  },

  // -------- Plantillas de estilo (Fase 2) --------
  async listTemplates(apiKey: string, signal?: AbortSignal): Promise<CaptionTemplate[]> {
    const res = await apiFetch(
      '/v1/videos/captions/templates?limit=100',
      apiKey,
      { method: 'GET' },
      API_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      throw new Error(`No se pudieron listar las plantillas: ${await readError(res)}`);
    }
    const body = (await res.json()) as { data?: Record<string, any>[] };
    const templates = (body.data || []).map((t) => ({
      id: String(t.id),
      name: String(t.name ?? t.id),
      previewUrl: t.preview_url ? String(t.preview_url) : null,
    }));
    log.info(`${templates.length} plantillas de captions cargadas`);
    return templates;
  },

  // -------- Enviar job de captioning (Fase 2) --------
  async submitCaptionJob(
    input: SubmitCaptionInput,
    signal?: AbortSignal
  ): Promise<CaptionJob> {
    // multipart/form-data: el video como archivo + el id de plantilla.
    // No fijamos Content-Type: FormData define el boundary automáticamente.
    const form = new FormData();
    form.append('caption_template_id', input.captionTemplateId);
    form.append(
      'video',
      new Blob([new Uint8Array(input.videoBytes)], { type: 'video/mp4' }),
      input.videoFilename
    );

    const res = await apiFetch(
      '/v1/videos/captions',
      input.apiKey,
      { method: 'POST', body: form },
      SUBMIT_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      throw new Error(
        `Captions AI rechazó el job (HTTP ${res.status}): ${await readError(res)}`
      );
    }
    const job = mapJob((await res.json()) as Record<string, any>);
    log.info(`job de captions creado id=${job.id} status=${job.status}`);
    return job;
  },

  // -------- Polling del job (Fase 2) --------
  async getCaptionJob(
    apiKey: string,
    jobId: string,
    signal?: AbortSignal
  ): Promise<CaptionJob> {
    const res = await apiFetch(
      `/v1/videos/${encodeURIComponent(jobId)}`,
      apiKey,
      { method: 'GET' },
      API_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      throw new Error(`No se pudo consultar el job ${jobId}: ${await readError(res)}`);
    }
    return mapJob((await res.json()) as Record<string, any>, jobId);
  },

  // -------- URL del video subtitulado terminado (Fase 2) --------
  async getCaptionedVideoUrl(
    apiKey: string,
    jobId: string,
    signal?: AbortSignal
  ): Promise<string> {
    // /content redirige al CDN. Seguimos el redirect pero NO descargamos el
    // cuerpo: solo necesitamos la URL final (res.url).
    const res = await apiFetch(
      `/v1/videos/${encodeURIComponent(jobId)}/content`,
      apiKey,
      { method: 'GET' },
      API_TIMEOUT_MS,
      signal
    );
    try {
      if (!res.ok) {
        throw new Error(
          `No se pudo obtener el video subtitulado (HTTP ${res.status}).`
        );
      }
      return res.url;
    } finally {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
    }
  },
};
