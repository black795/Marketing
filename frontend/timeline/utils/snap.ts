/**
 * Magnetic snap — encuentra el frame "imán" más cercano a `frame`.
 *
 * Imanes considerados (en orden de prioridad cuando hay empate):
 *   1. Playhead actual.
 *   2. Inicio/fin de cada escena (todos los `startFrame`/`endFrame`).
 *   3. Multiplos del grid (1 segundo por defecto).
 *
 * Devuelve el frame snappeado si está dentro del `thresholdFrames`; si no,
 * devuelve el frame original (sin snap).
 */
import type { Scene } from '@/editing';

export interface SnapOptions {
  frame: number;
  scenes: Scene[];
  playheadFrame: number;
  fps: number;
  /** En frames. Si el imán está más lejos que esto → no snap. */
  thresholdFrames?: number;
  /** Excluir este sceneId del cálculo (cuando se mueve esta escena). */
  excludeSceneId?: string;
}

export interface SnapResult {
  frame: number;
  snapped: boolean;
  source: 'playhead' | 'scene-start' | 'scene-end' | 'grid' | 'none';
}

export function findSnap(opts: SnapOptions): SnapResult {
  const { frame, scenes, playheadFrame, fps, thresholdFrames = 6, excludeSceneId } = opts;

  type Candidate = { f: number; src: SnapResult['source'] };
  const candidates: Candidate[] = [{ f: playheadFrame, src: 'playhead' }];

  for (const s of scenes) {
    if (s.id === excludeSceneId) continue;
    candidates.push({ f: s.startFrame, src: 'scene-start' });
    candidates.push({ f: s.endFrame, src: 'scene-end' });
  }

  // Grid de 1 segundo
  const gridFrame = Math.round(frame / fps) * fps;
  candidates.push({ f: gridFrame, src: 'grid' });

  let best: { dist: number; cand: Candidate } | null = null;
  for (const c of candidates) {
    const dist = Math.abs(c.f - frame);
    if (!best || dist < best.dist) {
      best = { dist, cand: c };
    }
  }

  if (best && best.dist <= thresholdFrames) {
    return { frame: best.cand.f, snapped: true, source: best.cand.src };
  }
  return { frame, snapped: false, source: 'none' };
}
