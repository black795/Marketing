/** Conversiones entre frames, segundos y código de tiempo. */

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(Math.round(seconds * fps), 1);
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/** "00:03.50" — útil para UI. */
export function framesToMmSs(frames: number, fps: number): string {
  const total = frames / fps;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Suma las duraciones (en frames) de un array de escenas. */
export function sumDurationFrames<T extends { durationFrames: number }>(scenes: T[]): number {
  return scenes.reduce((acc, s) => acc + s.durationFrames, 0);
}
