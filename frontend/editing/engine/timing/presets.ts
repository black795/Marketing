/**
 * Presets del Timing Engine — controlan agresividad.
 *
 *   tight  → corta silencios largos, sube velocidad de body, hook acelerado.
 *   balanced → moderado: respeta el pacing original salvo en silencios obvios.
 *   relaxed  → no toca speed; sólo recorta silencios extremos. Podcast.
 */

export interface TimingPreset {
  id: string;
  label: string;
  description: string;
  /** Umbral en frames: pausas más largas que esto se consideran "silencio". */
  silenceThresholdFrames: number;
  /** Velocidad máxima que el engine puede aplicar a una escena. */
  maxSpeed: number;
  /** Velocidad mínima. */
  minSpeed: number;
  /** Velocidad recomendada para escenas del rol "hook". */
  hookSpeed: number;
  /** Si true, recorta silencios al inicio/fin de escenas. */
  removeEdgeSilence: boolean;
  /** Densidad objetivo de palabras/segundo (el engine acelera hasta acercarse). */
  targetWordsPerSecond: number;
}

export const TIMING_PRESETS: TimingPreset[] = [
  {
    id: 'tight',
    label: 'Tight',
    description: 'Estilo TikTok / Hormozi: cortes secos, hook acelerado.',
    silenceThresholdFrames: 8,
    maxSpeed: 1.25,
    minSpeed: 1.0,
    hookSpeed: 1.15,
    removeEdgeSilence: true,
    targetWordsPerSecond: 3.0,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Pacing natural — ajusta sólo lo evidente.',
    silenceThresholdFrames: 18,
    maxSpeed: 1.1,
    minSpeed: 1.0,
    hookSpeed: 1.05,
    removeEdgeSilence: true,
    targetWordsPerSecond: 2.5,
  },
  {
    id: 'relaxed',
    label: 'Relaxed',
    description: 'Podcast / cinemático — preserva tempo, sin speed ramps.',
    silenceThresholdFrames: 60,
    maxSpeed: 1.0,
    minSpeed: 1.0,
    hookSpeed: 1.0,
    removeEdgeSilence: false,
    targetWordsPerSecond: 2.0,
  },
];

export function getTimingPreset(id: string): TimingPreset {
  return TIMING_PRESETS.find((p) => p.id === id) ?? TIMING_PRESETS[1];
}
