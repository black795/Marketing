/**
 * EmotionMap — tabla configurable emotion → directrices visuales.
 *
 * El resto del motor (camera, sfx, timing, transitions) consulta este map
 * para no duplicar conocimiento de "qué hace una escena `excited`". Editar
 * el map cambia el comportamiento de TODO el sistema a la vez.
 */
import type { SceneEmotion } from '../../types/scene';

/** Directrices visuales asociadas a una emoción. */
export interface EmotionDirectives {
  /** Preset de cámara recomendado (id de `camera/presets`). */
  camera: string;
  /** 0..1 — multiplicador de shake / agitación visual. */
  energy: number;
  /** SFX recomendado en entrada (id del catálogo SFX) o null. */
  sfxIn: string | null;
  /** Transición de entrada recomendada (id de transitions/presets). */
  transitionIn: string;
  /** Velocidad de reproducción sugerida (1.0 = normal). */
  speed: number;
  /** Estilo de caption sugerido (id de captions/styles). */
  captionStyle: string;
}

/** Map base — cubre las 7 emociones del enum `SceneEmotion`. */
export type EmotionMap = Record<SceneEmotion, EmotionDirectives>;

/**
 * Garantiza un fallback si el caller pide una emoción no mapeada (e.g. tras
 * un import de un map parcial). El consumidor recibe SIEMPRE directrices.
 */
export function getDirectives(
  map: EmotionMap,
  emotion: SceneEmotion
): EmotionDirectives {
  return map[emotion] ?? map.neutral;
}
