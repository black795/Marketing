/** Conversiones frames ↔ pixels. Todas dependientes de `pxPerFrame`. */

export function framesToPx(frames: number, pxPerFrame: number): number {
  return frames * pxPerFrame;
}

export function pxToFrames(px: number, pxPerFrame: number): number {
  return Math.round(px / pxPerFrame);
}

/** Anchura mínima de un clip en px — evita bloques degenerados a 1px. */
export const MIN_CLIP_PX = 24;

/** Escalas de zoom disponibles. */
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 6, 8, 12];
