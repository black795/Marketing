import type {
  GenerateStoryRequest,
  GenerateStoryResponse,
  GenerateScriptRequest,
  GenerateScriptResponse,
  GenerateImagesFromScriptRequest,
  GenerateImagesFromScriptResponse,
  RegenerateImagesRequest,
  RegenerateImagesResponse,
  RegenerateImageResult,
  Scene,
  GenerateVideosFromScenesRequest,
  VideoSceneOutput,
} from '@/types/story';
import type {
  AvatarGenerationRequest,
  AvatarPhase,
  AvatarResult,
} from '@/types/avatar';
import { dlog, dwarn, derror, traceAbortSignal } from './debug-log';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function generateStory(
  payload: GenerateStoryRequest
): Promise<GenerateStoryResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateStoryResponse;
}

export async function generateScript(
  payload: GenerateScriptRequest,
  options: { signal?: AbortSignal } = {}
): Promise<GenerateScriptResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateScriptResponse;
}

export async function generateImagesFromScript(
  payload: GenerateImagesFromScriptRequest
): Promise<GenerateImagesFromScriptResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-images-from-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateImagesFromScriptResponse;
}

export async function regenerateImages(
  payload: RegenerateImagesRequest
): Promise<RegenerateImagesResponse> {
  const response = await fetch(`${BACKEND_URL}/api/regenerate-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as RegenerateImagesResponse;
}

// =====================================================================
// SSE streaming clients
// =====================================================================

export type StreamPhase =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'cancelled'
  | 'done'
  | 'error';

export interface ImageStreamCallbacks {
  onStart?: (info: {
    total: number;
    model: string;
    projectId: string | null;
  }) => void;
  onSceneStart?: (info: {
    scene_number: number;
    index: number;
    total: number;
  }) => void;
  onScene?: (info: {
    scene: Scene;
    index: number;
    total: number;
    progress: number;
  }) => void;
  onWarning?: (message: string) => void;
}

export interface ImageStreamResult {
  status: 'done' | 'cancelled';
  scenes: Scene[];
  failed: number;
}

export class StreamCancelledError extends Error {
  constructor() {
    super('Stream cancelado por el cliente');
    this.name = 'StreamCancelledError';
  }
}

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<{ event: string; data: any }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith(':')) continue; // comment / keepalive
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join('\n');
      let data: any = dataStr;
      try {
        data = JSON.parse(dataStr);
      } catch {
        // ignore
      }
      yield { event, data };
    }
  }
}

export async function streamGenerateImagesFromScript(
  payload: GenerateImagesFromScriptRequest,
  callbacks: ImageStreamCallbacks,
  signal: AbortSignal
): Promise<ImageStreamResult> {
  if (signal.aborted) {
    throw new StreamCancelledError();
  }
  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/generate-images-from-script?stream=1`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal,
      }
    );
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  if (!response.ok || !response.body) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  const scenesById = new Map<number, Scene>();
  let status: 'done' | 'cancelled' = 'cancelled';
  let failed = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      switch (event) {
        case 'start':
          callbacks.onStart?.({
            total: data.total,
            model: data.model,
            projectId: data.projectId ?? null,
          });
          break;
        case 'scene-start':
          callbacks.onSceneStart?.({
            scene_number: data.scene_number,
            index: data.index,
            total: data.total,
          });
          break;
        case 'scene-done':
          scenesById.set(data.scene.scene_number, data.scene as Scene);
          callbacks.onScene?.({
            scene: data.scene as Scene,
            index: data.index,
            total: data.total,
            progress: data.progress,
          });
          break;
        case 'warning':
          callbacks.onWarning?.(String(data?.message ?? ''));
          break;
        case 'cancelled':
          status = 'cancelled';
          if (Array.isArray(data?.scenes)) {
            for (const s of data.scenes as Scene[]) {
              scenesById.set(s.scene_number, s);
            }
          }
          break;
        case 'done':
          status = 'done';
          failed = Number(data?.failed ?? 0);
          if (Array.isArray(data?.scenes)) {
            for (const s of data.scenes as Scene[]) {
              scenesById.set(s.scene_number, s);
            }
          }
          break;
      }
    }
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  const scenes = Array.from(scenesById.values()).sort(
    (a, b) => a.scene_number - b.scene_number
  );
  return { status, scenes, failed };
}

export interface RegenerateStreamCallbacks {
  onStart?: (info: { total: number; model: string }) => void;
  onSceneStart?: (info: {
    scene_number: number;
    index: number;
    total: number;
  }) => void;
  onResult?: (info: {
    result: RegenerateImageResult;
    index: number;
    total: number;
    progress: number;
  }) => void;
}

export interface RegenerateStreamResult {
  status: 'done' | 'cancelled';
  results: RegenerateImageResult[];
  failed: number;
}

/**
 * Atajo para regenerar una sola escena. Devuelve directamente el resultado
 * (o lanza StreamCancelledError si el usuario cancela).
 */
export async function regenerateSingleScene(
  payload: {
    model: string;
    scene_number: number;
    image_prompt: string;
    quality?: string;
    aspectRatio?: string;
    referenceImages?: string[];
  },
  callbacks: { onProgress?: (msg: string) => void } = {},
  signal: AbortSignal
): Promise<RegenerateImageResult> {
  const outcome = await streamRegenerateImages(
    {
      model: payload.model,
      scenes: [
        {
          scene_number: payload.scene_number,
          image_prompt: payload.image_prompt,
        },
      ],
      quality: payload.quality,
      aspectRatio: payload.aspectRatio,
      referenceImages: payload.referenceImages,
    },
    {
      onStart: () => callbacks.onProgress?.('Conectando con el worker…'),
      onSceneStart: () => callbacks.onProgress?.('Generando imagen…'),
      onResult: () => callbacks.onProgress?.('Imagen lista'),
    },
    signal
  );

  if (outcome.status === 'cancelled') {
    throw new StreamCancelledError();
  }
  const r = outcome.results[0];
  if (!r) {
    throw new Error('El worker no devolvió resultado');
  }
  return r;
}

export async function streamRegenerateImages(
  payload: RegenerateImagesRequest,
  callbacks: RegenerateStreamCallbacks,
  signal: AbortSignal
): Promise<RegenerateStreamResult> {
  const startedAt = Date.now();
  // Traza el signal: si el abort se dispara, sabremos cuándo y por qué.
  // Es el primer sitio donde detectar una cancelación accidental.
  const untrace = traceAbortSignal(signal, 'regenerate-images');
  dlog('sse', 'regenerate: abriendo stream', {
    scenes: payload.scenes.length,
    model: payload.model,
    signalYaAbortado: signal.aborted,
  });
  if (signal.aborted) {
    // El fetch fallaría igual; lo registramos explícitamente para no
    // confundir esto con un abort "a media generación".
    dwarn('sse', 'regenerate: el signal ya estaba abortado ANTES del fetch');
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/regenerate-images?stream=1`, {
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
      dwarn('sse', 'regenerate: fetch abortado durante la conexión inicial');
      throw new StreamCancelledError();
    }
    derror('sse', 'regenerate: fetch falló al conectar', err);
    throw err;
  }

  if (!response.ok || !response.body) {
    untrace();
    derror('sse', `regenerate: backend respondió ${response.status}`);
    throw new Error(`Backend responded with status ${response.status}`);
  }

  const resultsById = new Map<number, RegenerateImageResult>();
  let status: 'done' | 'cancelled' = 'cancelled';
  let failed = 0;
  let eventCount = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      eventCount += 1;
      dlog('sse', `regenerate: evento "${event}"`, data);
      switch (event) {
        case 'start':
          callbacks.onStart?.({ total: data.total, model: data.model });
          break;
        case 'scene-start':
          callbacks.onSceneStart?.({
            scene_number: data.scene_number,
            index: data.index,
            total: data.total,
          });
          break;
        case 'scene-done':
          resultsById.set(
            data.result.scene_number,
            data.result as RegenerateImageResult
          );
          callbacks.onResult?.({
            result: data.result as RegenerateImageResult,
            index: data.index,
            total: data.total,
            progress: data.progress,
          });
          break;
        case 'cancelled':
          status = 'cancelled';
          if (Array.isArray(data?.results)) {
            for (const r of data.results as RegenerateImageResult[]) {
              resultsById.set(r.scene_number, r);
            }
          }
          break;
        case 'done':
          status = 'done';
          failed = Number(data?.failed ?? 0);
          if (Array.isArray(data?.results)) {
            for (const r of data.results as RegenerateImageResult[]) {
              resultsById.set(r.scene_number, r);
            }
          }
          break;
      }
    }
  } catch (err) {
    untrace();
    if ((err as { name?: string })?.name === 'AbortError') {
      // Cancelación REAL: el usuario (o un cierre de panel) abortó el signal.
      dwarn('sse', 'regenerate: stream abortado por el cliente', {
        eventosRecibidos: eventCount,
        elapsedMs: Date.now() - startedAt,
      });
      throw new StreamCancelledError();
    }
    derror('sse', 'regenerate: el stream falló', err);
    throw err;
  }

  untrace();
  dlog('sse', `regenerate: stream finalizado status=${status}`, {
    eventosRecibidos: eventCount,
    resultados: resultsById.size,
    failed,
    elapsedMs: Date.now() - startedAt,
  });

  const results = Array.from(resultsById.values()).sort(
    (a, b) => a.scene_number - b.scene_number
  );
  return { status, results, failed };
}

// =====================================================================
// SSE: video generation (Kling v3 family)
// =====================================================================

export interface VideoStreamCallbacks {
  onStart?: (info: {
    total: number;
    model: string;
    duration: number;
    resolution: string;
  }) => void;
  onSceneStart?: (info: {
    scene_number: number;
    index: number;
    total: number;
  }) => void;
  onScene?: (info: {
    scene: VideoSceneOutput;
    index: number;
    total: number;
    progress: number;
  }) => void;
  onWarning?: (message: string) => void;
}

export interface VideoStreamResult {
  status: 'done' | 'cancelled';
  scenes: VideoSceneOutput[];
  failed: number;
}

export async function streamGenerateVideosFromScenes(
  payload: GenerateVideosFromScenesRequest,
  callbacks: VideoStreamCallbacks,
  signal: AbortSignal
): Promise<VideoStreamResult> {
  if (signal.aborted) {
    throw new StreamCancelledError();
  }
  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/generate-videos-from-scenes?stream=1`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal,
      }
    );
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  if (!response.ok || !response.body) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  const scenesById = new Map<number, VideoSceneOutput>();
  let status: 'done' | 'cancelled' = 'cancelled';
  let failed = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      switch (event) {
        case 'start':
          callbacks.onStart?.({
            total: data.total,
            model: data.model,
            duration: data.duration,
            resolution: data.resolution,
          });
          break;
        case 'scene-start':
          callbacks.onSceneStart?.({
            scene_number: data.scene_number,
            index: data.index,
            total: data.total,
          });
          break;
        case 'scene-done':
        case 'scene-error':
          scenesById.set(
            data.scene.scene_number,
            data.scene as VideoSceneOutput
          );
          callbacks.onScene?.({
            scene: data.scene as VideoSceneOutput,
            index: data.index,
            total: data.total,
            progress: data.progress,
          });
          break;
        case 'warning':
          callbacks.onWarning?.(String(data?.message ?? ''));
          break;
        case 'cancelled':
          status = 'cancelled';
          if (Array.isArray(data?.scenes)) {
            for (const s of data.scenes as VideoSceneOutput[]) {
              scenesById.set(s.scene_number, s);
            }
          }
          break;
        case 'done':
          status = 'done';
          failed = Number(data?.failed ?? 0);
          if (Array.isArray(data?.scenes)) {
            for (const s of data.scenes as VideoSceneOutput[]) {
              scenesById.set(s.scene_number, s);
            }
          }
          break;
      }
    }
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  const scenes = Array.from(scenesById.values()).sort(
    (a, b) => a.scene_number - b.scene_number
  );
  return { status, scenes, failed };
}

// =====================================================================
// SSE: avatar generation (prunaai/p-video-avatar)
// =====================================================================

export interface AvatarStreamCallbacks {
  onStart?: (info: {
    jobId: string;
    model: string;
    resolution: string;
    mode: string;
  }) => void;
  /** Estado en vivo del render (processing → rendering). */
  onStatus?: (info: {
    phase: AvatarPhase;
    elapsedMs: number;
    message: string;
  }) => void;
  onWarning?: (message: string) => void;
}

export type AvatarStreamOutcome =
  | { status: 'completed'; result: AvatarResult }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' };

/**
 * Genera un video de avatar vía SSE. Devuelve el desenlace (completado /
 * fallido / cancelado). Lanza StreamCancelledError solo si el fetch se
 * aborta antes de recibir un evento de cierre del backend.
 */
export async function streamGenerateAvatar(
  payload: AvatarGenerationRequest,
  callbacks: AvatarStreamCallbacks,
  signal: AbortSignal
): Promise<AvatarStreamOutcome> {
  const startedAt = Date.now();
  const untrace = traceAbortSignal(signal, 'generate-avatar');
  dlog('sse', 'avatar: abriendo stream', {
    resolution: payload.resolution,
    mode: payload.audio ? 'audio' : 'tts',
    signalYaAbortado: signal.aborted,
  });

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/generate-avatar?stream=1`, {
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
      dwarn('sse', 'avatar: fetch abortado durante la conexión inicial');
      throw new StreamCancelledError();
    }
    derror('sse', 'avatar: fetch falló al conectar', err);
    throw err;
  }

  if (!response.ok || !response.body) {
    untrace();
    // El backend manda JSON con el detalle en errores de validación (400).
    let detail = `Backend responded with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    derror('sse', `avatar: backend respondió ${response.status}`, detail);
    throw new Error(detail);
  }

  let outcome: AvatarStreamOutcome = { status: 'cancelled' };
  let eventCount = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      eventCount += 1;
      dlog('sse', `avatar: evento "${event}"`, data);
      switch (event) {
        case 'start':
          callbacks.onStart?.({
            jobId: String(data?.jobId ?? ''),
            model: String(data?.model ?? 'p-video-avatar'),
            resolution: String(data?.resolution ?? ''),
            mode: String(data?.mode ?? ''),
          });
          break;
        case 'status':
          callbacks.onStatus?.({
            phase: (data?.phase as AvatarPhase) ?? 'processing',
            elapsedMs: Number(data?.elapsedMs ?? 0),
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
            error: String(data?.error ?? 'Generación fallida'),
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
      dwarn('sse', 'avatar: stream abortado por el cliente', {
        eventosRecibidos: eventCount,
        elapsedMs: Date.now() - startedAt,
      });
      throw new StreamCancelledError();
    }
    derror('sse', 'avatar: el stream falló', err);
    throw err;
  }

  untrace();
  dlog('sse', `avatar: stream finalizado status=${outcome.status}`, {
    eventosRecibidos: eventCount,
    elapsedMs: Date.now() - startedAt,
  });
  return outcome;
}
