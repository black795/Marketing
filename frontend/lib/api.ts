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
} from '@/types/story';

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

async function* parseSseStream(
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
  const response = await fetch(
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

export async function streamRegenerateImages(
  payload: RegenerateImagesRequest,
  callbacks: RegenerateStreamCallbacks,
  signal: AbortSignal
): Promise<RegenerateStreamResult> {
  const response = await fetch(
    `${BACKEND_URL}/api/regenerate-images?stream=1`,
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

  if (!response.ok || !response.body) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  const resultsById = new Map<number, RegenerateImageResult>();
  let status: 'done' | 'cancelled' = 'cancelled';
  let failed = 0;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
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
    if ((err as any)?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  const results = Array.from(resultsById.values()).sort(
    (a, b) => a.scene_number - b.scene_number
  );
  return { status, results, failed };
}
