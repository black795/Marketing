/**
 * Cliente SSE del render — abre stream contra `/api/render/:projectId`
 * y emite callbacks de progreso. Reusa `parseSseStream` de lib/api.
 */
import { parseSseStream, StreamCancelledError } from '@/lib/api';
import type { RenderJobInit, RenderStatus } from './types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface RenderProgressTick {
  phase: RenderStatus;
  message: string;
  progress: number | null;
}

export interface RenderRunResult {
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  cacheHits: number;
  cacheMisses: number;
  burnedCaptions: boolean;
  presetId: string | null;
}

export type RenderOutcome =
  | { status: 'done'; render: RenderRunResult }
  | { status: 'cancelled' }
  | { status: 'failed'; error: string };

export interface RenderCallbacks {
  onTick?: (tick: RenderProgressTick) => void;
}

export async function streamRenderJob(
  init: RenderJobInit,
  callbacks: RenderCallbacks,
  signal: AbortSignal
): Promise<RenderOutcome> {
  const res = await fetch(
    `${BACKEND_URL}/api/render/${encodeURIComponent(init.projectId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        presetId: init.presetId ?? null,
        burnCaptions: init.burnCaptions !== false,
        force: init.force === true,
        parallelism: init.parallelism,
      }),
      signal,
    }
  );
  if (!res.ok || !res.body) {
    let detail = `Backend respondió ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* no body */
    }
    throw new Error(detail);
  }

  let outcome: RenderOutcome = { status: 'cancelled' };

  try {
    for await (const { event, data } of parseSseStream(res.body)) {
      switch (event) {
        case 'progress':
          callbacks.onTick?.({
            phase: (data?.phase as RenderStatus) ?? 'preparing',
            message: String(data?.message ?? ''),
            progress: typeof data?.progress === 'number' ? data.progress : null,
          });
          break;
        case 'done':
          outcome = { status: 'done', render: data.render as RenderRunResult };
          break;
        case 'cancelled':
          outcome = { status: 'cancelled' };
          break;
        case 'error':
          outcome = { status: 'failed', error: String(data?.error ?? 'Render falló') };
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

export interface BackendExportPreset {
  id: string;
  label: string;
  emoji: string;
  platform: string;
  aspect: '9:16' | '1:1' | '16:9';
  width: number;
  height: number;
  fps: number;
  crf: number;
  preset: string;
  audioKbps: number;
  maxDurationSec: number;
  description: string;
}

/** Lista de export presets soportados por el backend. */
export async function listExportPresets(): Promise<BackendExportPreset[]> {
  const res = await fetch(`${BACKEND_URL}/api/render/presets`);
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  const body = (await res.json()) as { presets: BackendExportPreset[] };
  return body.presets;
}
