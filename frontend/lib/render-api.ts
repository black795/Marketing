import { parseSseStream, StreamCancelledError } from './api';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export type RenderPhase =
  | 'idle'
  | 'connecting'
  | 'preparing'
  | 'downloading'
  | 'building-captions'
  | 'encoding'
  | 'done'
  | 'error'
  | 'cancelled';

export interface RenderProgress {
  phase: RenderPhase;
  message: string;
  /** 0..1 dentro de la fase activa cuando aplica. */
  progress?: number;
}

export interface RenderResult {
  projectId: string;
  staticPath: string;
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  clipCount: number;
  burnedCaptions: boolean;
  renderedAt: string;
}

export interface RenderStreamCallbacks {
  onStart?: (info: { projectId: string; burnCaptions: boolean }) => void;
  onProgress?: (p: RenderProgress) => void;
  onWarning?: (message: string) => void;
}

export type RenderOutcome =
  | { status: 'done'; render: RenderResult }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

/**
 * Stream del render server-side. Devuelve el desenlace (done / cancelled /
 * error). Lanza `StreamCancelledError` si el fetch se aborta antes de
 * recibir un evento terminal del backend.
 */
export async function streamRender(
  projectId: string,
  opts: { burnCaptions?: boolean } = {},
  callbacks: RenderStreamCallbacks = {},
  signal: AbortSignal
): Promise<RenderOutcome> {
  const response = await fetch(
    `${BACKEND_URL}/api/render/${encodeURIComponent(projectId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ burnCaptions: opts.burnCaptions ?? true }),
      signal,
    }
  );

  if (!response.ok || !response.body) {
    let detail = `Backend respondió ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail);
  }

  let outcome: RenderOutcome = { status: 'cancelled' };

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      switch (event) {
        case 'start':
          callbacks.onStart?.({
            projectId: String(data?.projectId ?? projectId),
            burnCaptions: Boolean(data?.burnCaptions ?? true),
          });
          break;
        case 'progress':
          callbacks.onProgress?.({
            phase: (data?.phase as RenderPhase) ?? 'preparing',
            message: String(data?.message ?? ''),
            progress:
              typeof data?.progress === 'number' ? data.progress : undefined,
          });
          break;
        case 'warning':
          callbacks.onWarning?.(String(data?.message ?? ''));
          break;
        case 'done':
          outcome = {
            status: 'done',
            render: data.render as RenderResult,
          };
          break;
        case 'cancelled':
          outcome = { status: 'cancelled' };
          break;
        case 'error':
          outcome = {
            status: 'error',
            error: String(data?.error ?? 'Render falló'),
          };
          break;
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new StreamCancelledError();
    }
    throw err;
  }

  return outcome;
}

/** Devuelve el último render persistido o null si nunca se renderizó. */
export async function getLastRender(
  projectId: string
): Promise<RenderResult | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/render/${encodeURIComponent(projectId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  const body = (await res.json()) as { render: RenderResult };
  return body.render;
}
