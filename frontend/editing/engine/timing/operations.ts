/**
 * Operaciones de timing — el output del analizador.
 *
 * Cada operación es una instrucción declarativa; el `process.ts` las aplica
 * sobre una escena para producir una escena nueva con cortes/ramps.
 */

export type TimingOperation =
  | { kind: 'trim'; sceneId: string; newDurationFrames: number; reason: string }
  | { kind: 'speed'; sceneId: string; speed: number; reason: string }
  | { kind: 'jump-cut'; sceneId: string; atFrame: number; cutDurationFrames: number; reason: string }
  | { kind: 'silence-remove'; sceneId: string; rangeStart: number; rangeEnd: number; reason: string };

export interface TimingAnalysis {
  operations: TimingOperation[];
  /** Texto humano-legible resumiendo el plan. */
  summary: string;
  /** Métricas detectadas por escena: words/sec, longest gap, etc. */
  metricsByScene: Record<string, SceneTimingMetrics>;
}

export interface SceneTimingMetrics {
  wordCount: number;
  /** Palabras por segundo. <1.5 suele ser lento, >3 acelerado. */
  wordsPerSecond: number;
  /** Pausa más larga entre palabras consecutivas, en frames. */
  longestGapFrames: number;
  /** Suma de pausas en frames (proxy de "silencio"). */
  totalSilenceFrames: number;
  /** "energy" estimado 0..1 (heurística sobre densidad de palabras + emoción). */
  energy: number;
}
