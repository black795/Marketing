/**
 * Tipos del Render Queue del frontend.
 *
 * El render real corre en el backend (ffmpeg + cache + parallel + SSE).
 * El frontend solo MIRA los jobs: estado, progreso, fase, output URL.
 */

export type RenderStatus =
  | 'queued'
  | 'connecting'
  | 'preparing'
  | 'downloading'
  | 'building-captions'
  | 'encoding-segments'
  | 'concat'
  | 'final-pass'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface RenderJob {
  id: string;
  projectId: string;
  /** Preset id si se eligió uno, null si renderConfig nativo. */
  presetId: string | null;
  burnCaptions: boolean;
  force: boolean;
  status: RenderStatus;
  /** 0..1 dentro de la fase activa cuando aplica. */
  progress: number | null;
  /** Mensaje legible del paso actual. */
  message: string;
  createdAt: string;
  finishedAt?: string;
  outputUrl?: string;
  cacheHits?: number;
  durationSeconds?: number;
  error?: string;
}

export interface RenderJobInit {
  projectId: string;
  presetId?: string | null;
  burnCaptions?: boolean;
  force?: boolean;
  parallelism?: number;
}
