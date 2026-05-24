/**
 * Elige la transición de entrada de una escena en función del par
 * (escena previa → escena actual). Sin escena previa (la primera), devuelve
 * 'cut' o 'fade' según el rol.
 *
 * Reglas:
 *   1. Si la emoción cambia mucho → transición alta-energía.
 *   2. Si el rol es CTA → impacto fuerte (zoom-in / whip).
 *   3. EmotionMap directives lo override para el caso "normal".
 */
import type { Scene } from '../../types/scene';
import type { EmotionMap } from '../emotion/map';
import { getDirectives } from '../emotion/map';

const ENERGY_BY_EMOTION: Record<Scene['emotion'], number> = {
  neutral: 0.4,
  excited: 0.9,
  serious: 0.3,
  inspirational: 0.5,
  urgent: 1.0,
  calm: 0.1,
  playful: 0.7,
};

export function pickTransitionIn(
  current: Scene,
  previous: Scene | null,
  emotionMap: EmotionMap
): string {
  if (!previous) {
    return current.role === 'hook' ? 'cut' : 'fade';
  }

  if (current.role === 'cta') return 'zoom-in';

  const delta = Math.abs(
    ENERGY_BY_EMOTION[current.emotion] - ENERGY_BY_EMOTION[previous.emotion]
  );
  if (delta > 0.5) return 'whip';
  if (delta > 0.3) return 'slide-left';

  // Default vía emoción
  return getDirectives(emotionMap, current.emotion).transitionIn;
}
