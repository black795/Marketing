/**
 * Clasificador de rol narrativo de una escena.
 *
 * Combina dos señales:
 *   1. Posición en el Reel (primera/última/etc.).
 *   2. Heurísticas de texto sobre la narración (ver utils/narrative).
 *
 * Cuando ambas coinciden gana la del texto (es señal más fuerte). Si el
 * texto no decide nada, se cae a la heurística posicional.
 */
import { detectNarrativeRole } from '../utils/narrative';
import type { SceneRole } from '../types/scene';

export interface ClassifyInput {
  /** índice 0-based en el orden actual. */
  index: number;
  total: number;
  narration: string;
}

export function classifyScene(input: ClassifyInput): SceneRole {
  const { index, total, narration } = input;
  const textual = detectNarrativeRole(narration);
  if (textual) return textual;

  // Posicional: hook → intro? → body... → outro
  if (total <= 1) return 'hook';
  if (index === 0) return 'hook';
  if (index === total - 1) return 'outro';
  if (index === 1 && total >= 5) return 'intro';
  return 'body';
}
