const WORKER_URL =
  process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

const REQUEST_TIMEOUT_MS = 240_000;
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 12_000;

export interface GenerateVideoInput {
  model: string;
  prompt: string;
  /** Imagen inicial (data: o http URL) — image-to-video. */
  imageUrl?: string;
  /** Identity refs (sólo kling-v3-omni, máx 7). */
  referenceImageUrls?: string[];
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  sound?: boolean;
  abortSignal?: AbortSignal;
}

export class CancelledError extends Error {
  constructor(message = 'Cancelled by client') {
    super(message);
    this.name = 'CancelledError';
  }
}

export interface GenerateVideoResult {
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
  if (code) {
    return `Error de red ${code} hacia ${WORKER_URL}: ${err.message}`;
  }
  return err.message;
}

function parseRetryAfterMs(detail: string): number {
  const match = detail.match(/in\s*~?\s*(\d+)\s*s/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    return seconds * 1000 + 1500;
  }
  return DEFAULT_RETRY_DELAY_MS;
}

async function attempt(input: GenerateVideoInput): Promise<Attempt> {
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
    const response = await fetch(`${WORKER_URL}/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        image_url: input.imageUrl ?? null,
        reference_image_urls: input.referenceImageUrls ?? [],
        aspect_ratio: input.aspectRatio ?? '9:16',
        duration: input.duration ?? 5,
        resolution: input.resolution ?? '1080p',
        sound: input.sound ?? true,
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
        // ignore parse failures
      }
      const retryable = response.status === 429 || response.status === 502;
      console.warn(
        `[videoWorker] ← ${response.status} after ${elapsedMs}ms${
          retryable ? ' (retryable)' : ''
        }: ${detail}`
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
      console.warn(
        `[videoWorker] ← 200 after ${elapsedMs}ms but no video_url in body`
      );
      return {
        ok: false,
        status: 200,
        detail: 'Worker returned no video_url',
        retryable: false,
      };
    }

    console.log(
      `[videoWorker] ← 200 after ${elapsedMs}ms video_url=${data.video_url.slice(0, 80)}…`
    );
    return { ok: true, video_url: data.video_url };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === 'AbortError') {
      if (external?.aborted) {
        return { ok: false, status: null, detail: 'Cancelled by client', retryable: false };
      }
      const msg = `Timeout after ${REQUEST_TIMEOUT_MS / 1000}s waiting for ${WORKER_URL}`;
      console.error(`[videoWorker] ✗ ${msg}`);
      return { ok: false, status: null, detail: msg, retryable: false };
    }
    const friendly = describeFetchError(err);
    console.error(
      `[videoWorker] ✗ after ${elapsedMs}ms: ${friendly}`,
      err instanceof Error && (err as any).cause
        ? { cause: (err as any).cause }
        : ''
    );
    return { ok: false, status: null, detail: friendly, retryable: false };
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

export async function generateVideo(
  input: GenerateVideoInput
): Promise<GenerateVideoResult> {
  const shortPrompt = input.prompt.slice(0, 60).replace(/\s+/g, ' ');

  for (let i = 1; i <= MAX_RETRIES; i++) {
    if (input.abortSignal?.aborted) {
      return { video_url: null, video_error: 'Cancelled by client' };
    }

    console.log(
      `[videoWorker] → POST ${WORKER_URL}/generate-video attempt=${i}/${MAX_RETRIES} model=${input.model} dur=${input.duration ?? 5}s res=${input.resolution ?? '1080p'} prompt="${shortPrompt}…"`
    );

    const result = await attempt(input);

    if (result.ok) {
      return { video_url: result.video_url };
    }

    if (!result.retryable || i === MAX_RETRIES) {
      return { video_url: null, video_error: result.detail };
    }

    const delay =
      result.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS * Math.pow(1.5, i - 1);
    console.log(
      `[videoWorker] ⏳ retry en ${Math.round(delay / 1000)}s (status=${result.status})`
    );
    try {
      await sleep(delay, input.abortSignal);
    } catch {
      return { video_url: null, video_error: 'Cancelled by client' };
    }
  }

  return { video_url: null, video_error: 'Max retries exceeded' };
}
