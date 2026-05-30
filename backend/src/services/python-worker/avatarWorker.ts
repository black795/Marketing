import { createLogger, type LogContext } from '../logger';
import { isSandboxEnabled, placeholderVideoUrl } from '../sandbox';

const WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

// El avatar/lipsync es un render de video: puede tardar varios minutos.
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 12_000;

const log = createLogger('avatarWorker');

export interface GenerateAvatarInput {
  /** Motor: "p_video_avatar" (default, TTS) | "omni_human" (realista, requiere audio). */
  model?: string;
  /** Imagen del avatar (data: URL o http URL). Requerida. */
  image: string;
  resolution?: string;
  /** Audio propio (data: URL o http URL). Si se entrega, manda sobre voice_*. */
  audio?: string;
  voiceScript?: string;
  voice?: string;
  voicePrompt?: string;
  voiceLanguage?: string;
  videoPrompt?: string;
  seed?: number | null;
  disableSafetyFilter?: boolean;
  disablePromptUpsampling?: boolean;
  /** Cancela el fetch + retries + sleeps en curso. */
  abortSignal?: AbortSignal;
  /** Contexto de trazabilidad (requestId / jobId). */
  logContext?: LogContext;
}

export class CancelledError extends Error {
  constructor(message = 'Cancelled by client') {
    super(message);
    this.name = 'CancelledError';
  }
}

export interface GenerateAvatarResult {
  video_url: string | null;
  video_error?: string;
}

interface AttemptResult {
  ok: true;
  video_url: string;
}
interface AttemptError {
  ok: false;
  status: number | null;
  detail: string;
  retryable: boolean;
  retryAfterMs?: number;
}
type Attempt = AttemptResult | AttemptError;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown worker error';
  const cause: any = (err as any).cause;
  const code: string | undefined = cause?.code;

  if (code === 'ECONNREFUSED') {
    return `Python worker no responde en ${WORKER_URL} (ECONNREFUSED). ¿Está corriendo el FastAPI worker en :5000?`;
  }
  if (code === 'ENOTFOUND') {
    return `No se pudo resolver el host del worker (${WORKER_URL}). Revisa PYTHON_WORKER_URL.`;
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Timeout conectando a ${WORKER_URL}. ¿Worker bloqueado o firewall?`;
  }
  if (code === 'ECONNRESET') {
    return `Conexión con ${WORKER_URL} reseteada. El worker pudo haber muerto a mitad de la respuesta.`;
  }
  if (code) return `Error de red ${code} hacia ${WORKER_URL}: ${err.message}`;
  return err.message;
}

function parseRetryAfterMs(detail: string): number {
  const match = detail.match(/in\s*~?\s*(\d+)\s*s/i);
  if (match) return parseInt(match[1], 10) * 1000 + 1500;
  return DEFAULT_RETRY_DELAY_MS;
}

async function attempt(input: GenerateAvatarInput): Promise<Attempt> {
  const ctx = input.logContext;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  const external = input.abortSignal;
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(`${WORKER_URL}/generate-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model ?? 'p_video_avatar',
        image: input.image,
        resolution: input.resolution ?? '720p',
        audio: input.audio ?? null,
        voice_script: input.voiceScript ?? '',
        voice: input.voice ?? 'Zephyr (Female)',
        voice_prompt: input.voicePrompt ?? 'Say the following.',
        voice_language: input.voiceLanguage ?? 'English (US)',
        video_prompt: input.videoPrompt ?? 'The person is talking.',
        seed: input.seed ?? null,
        disable_safety_filter: input.disableSafetyFilter ?? true,
        disable_prompt_upsampling: input.disablePromptUpsampling ?? false,
      }),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      let detail = `Worker responded ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* ignore parse failures */
      }
      const retryable = response.status === 429 || response.status === 502;
      log.warn(
        `← ${response.status} en ${elapsedMs}ms${retryable ? ' (reintentable)' : ''}: ${detail}`,
        ctx
      );
      return {
        ok: false,
        status: response.status,
        detail,
        retryable,
        retryAfterMs:
          response.status === 429 ? parseRetryAfterMs(detail) : undefined,
      };
    }

    const data = (await response.json()) as { video_url?: string };
    if (!data.video_url) {
      log.warn(`← 200 en ${elapsedMs}ms pero sin video_url en el body`, ctx);
      return {
        ok: false,
        status: 200,
        detail: 'Worker returned no video_url',
        retryable: false,
      };
    }

    log.info(`← 200 en ${elapsedMs}ms video_url=${data.video_url.slice(0, 80)}…`, ctx);
    return { ok: true, video_url: data.video_url };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === 'AbortError') {
      if (external?.aborted) {
        log.info(`✗ abortado por cancelación del cliente tras ${elapsedMs}ms`, ctx);
        return { ok: false, status: null, detail: 'Cancelled by client', retryable: false };
      }
      const msg = `Timeout after ${REQUEST_TIMEOUT_MS / 1000}s waiting for ${WORKER_URL}`;
      log.error(`✗ ${msg}`, ctx);
      return { ok: false, status: null, detail: msg, retryable: false };
    }
    const friendly = describeFetchError(err);
    log.error(`✗ tras ${elapsedMs}ms: ${friendly}`, ctx, err);
    return { ok: false, status: null, detail: friendly, retryable: false };
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

export async function generateAvatar(
  input: GenerateAvatarInput
): Promise<GenerateAvatarResult> {
  const ctx = input.logContext;

  // Short-circuit: sandbox mode devuelve un mp4 placeholder (sin lipsync).
  if (isSandboxEnabled()) {
    try {
      const seedKey = String(ctx?.jobId ?? input.voiceScript ?? input.videoPrompt ?? 'avatar');
      const url = await placeholderVideoUrl({
        prompt: input.videoPrompt ?? input.voiceScript ?? 'avatar',
        aspectRatio: '9:16',
        durationSec: 6,
        seedKey,
        publicBaseUrl: PUBLIC_BASE_URL,
      });
      log.info(`🧪 sandbox avatar placeholder → ${url}`, ctx);
      return { video_url: url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`✗ sandbox avatar placeholder falló: ${msg}`, ctx);
      return { video_url: null, video_error: `sandbox placeholder error: ${msg}` };
    }
  }

  for (let i = 1; i <= MAX_RETRIES; i++) {
    if (input.abortSignal?.aborted) {
      log.info('cancelado antes del intento — abort signal activo', ctx);
      return { video_url: null, video_error: 'Cancelled by client' };
    }

    log.info(
      `→ POST ${WORKER_URL}/generate-avatar attempt=${i}/${MAX_RETRIES} ` +
        `resolution=${input.resolution ?? '720p'} mode=${input.audio ? 'audio' : 'tts'}`,
      ctx
    );

    const result = await attempt(input);

    if (result.ok) return { video_url: result.video_url };

    if (!result.retryable || i === MAX_RETRIES) {
      return { video_url: null, video_error: result.detail };
    }

    const delay =
      result.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS * Math.pow(1.5, i - 1);
    log.info(`⏳ retry en ${Math.round(delay / 1000)}s (status=${result.status})`, ctx);
    try {
      await sleep(delay, input.abortSignal);
    } catch {
      log.info('cancelado durante el backoff de retry', ctx);
      return { video_url: null, video_error: 'Cancelled by client' };
    }
  }

  return { video_url: null, video_error: 'Max retries exceeded' };
}
