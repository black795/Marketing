const WORKER_URL =
  process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 12_000;

export interface GenerateImageInput {
  model: string;
  prompt: string;
  /**
   * Lista de imágenes de referencia (data: URLs o http URLs). El worker
   * las propaga a `image_input` / `input_images` del modelo según el caso
   * para preservar identidad del personaje entre escenas.
   */
  referenceImageUrls?: string[];
  aspectRatio?: string;
  /** "draft" | "standard" | "high" | "ultra" — el worker mapea por modelo. */
  quality?: string;
}

export interface GenerateImageResult {
  image_url: string | null;
  image_error?: string;
}

interface AttemptResult {
  ok: true;
  image_url: string;
}
interface AttemptError {
  ok: false;
  status: number | null;
  detail: string;
  retryable: boolean;
  retryAfterMs?: number;
}
type Attempt = AttemptResult | AttemptError;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  // Replicate suele decir "rate limit resets in ~10s" en el detail.
  const match = detail.match(/in\s*~?\s*(\d+)\s*s/i);
  if (match) {
    const seconds = parseInt(match[1], 10);
    return seconds * 1000 + 1500; // pequeño buffer
  }
  return DEFAULT_RETRY_DELAY_MS;
}

async function attempt(input: GenerateImageInput): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${WORKER_URL}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        reference_image_urls: input.referenceImageUrls ?? [],
        aspect_ratio: input.aspectRatio ?? '9:16',
        quality: input.quality ?? 'standard',
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
        `[imageWorker] ← ${response.status} after ${elapsedMs}ms${
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

    const data = (await response.json()) as { image_url?: string };
    if (!data.image_url) {
      console.warn(
        `[imageWorker] ← 200 after ${elapsedMs}ms but no image_url in body`
      );
      return {
        ok: false,
        status: 200,
        detail: 'Worker returned no image_url',
        retryable: false,
      };
    }

    console.log(
      `[imageWorker] ← 200 after ${elapsedMs}ms image_url=${data.image_url.slice(0, 80)}…`
    );
    return { ok: true, image_url: data.image_url };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === 'AbortError') {
      const msg = `Timeout after ${REQUEST_TIMEOUT_MS / 1000}s waiting for ${WORKER_URL}`;
      console.error(`[imageWorker] ✗ ${msg}`);
      return { ok: false, status: null, detail: msg, retryable: false };
    }
    const friendly = describeFetchError(err);
    console.error(
      `[imageWorker] ✗ after ${elapsedMs}ms: ${friendly}`,
      err instanceof Error && (err as any).cause
        ? { cause: (err as any).cause }
        : ''
    );
    return { ok: false, status: null, detail: friendly, retryable: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const shortPrompt = input.prompt.slice(0, 60).replace(/\s+/g, ' ');

  for (let i = 1; i <= MAX_RETRIES; i++) {
    console.log(
      `[imageWorker] → POST ${WORKER_URL}/generate-image attempt=${i}/${MAX_RETRIES} model=${input.model} prompt="${shortPrompt}…"`
    );

    const result = await attempt(input);

    if (result.ok) {
      return { image_url: result.image_url };
    }

    if (!result.retryable || i === MAX_RETRIES) {
      return { image_url: null, image_error: result.detail };
    }

    const delay =
      result.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS * Math.pow(1.5, i - 1);
    console.log(
      `[imageWorker] ⏳ retry en ${Math.round(delay / 1000)}s (status=${result.status})`
    );
    await sleep(delay);
  }

  return { image_url: null, image_error: 'Max retries exceeded' };
}

export async function checkWorkerHealth(): Promise<{
  ok: boolean;
  detail?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetch(`${WORKER_URL}/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false, detail: `health responded ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: describeFetchError(err) };
  } finally {
    clearTimeout(timer);
  }
}
