/**
 * Presets de EmotionMap — combos editoriales completos.
 *
 * Cambiar de preset = cambiar la "personalidad" del motor entero. Por
 * ejemplo, "viral" sube energía y velocidad, "cinematic" las baja.
 */
import type { EmotionMap } from './map';

export interface EmotionMapPreset {
  id: string;
  label: string;
  description: string;
  map: EmotionMap;
}

export const EMOTION_PRESETS: EmotionMapPreset[] = [
  {
    id: 'viral',
    label: 'Viral / TikTok',
    description: 'Energía alta, velocidad +, SFX agresivos, captions estilo TikTok.',
    map: {
      neutral: { camera: 'punch-in-soft', energy: 0.3, sfxIn: null, transitionIn: 'cut', speed: 1.05, captionStyle: 'tiktok' },
      excited: { camera: 'punch-zoom', energy: 0.8, sfxIn: 'bass-hit', transitionIn: 'whip', speed: 1.1, captionStyle: 'tiktok' },
      serious: { camera: 'slow-zoom', energy: 0.2, sfxIn: 'impact', transitionIn: 'fade', speed: 1.0, captionStyle: 'hormozi' },
      inspirational: { camera: 'cinematic-push', energy: 0.5, sfxIn: 'whoosh', transitionIn: 'fade', speed: 1.0, captionStyle: 'tiktok' },
      urgent: { camera: 'shake', energy: 0.9, sfxIn: 'glitch', transitionIn: 'glitch', speed: 1.15, captionStyle: 'hormozi' },
      calm: { camera: 'ken-burns', energy: 0.1, sfxIn: null, transitionIn: 'fade', speed: 0.95, captionStyle: 'cinematic' },
      playful: { camera: 'punch-zoom', energy: 0.6, sfxIn: 'whoosh', transitionIn: 'slide-left', speed: 1.08, captionStyle: 'tiktok' },
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematográfico',
    description: 'Movimientos lentos, captions mínimos, transiciones de fundido.',
    map: {
      neutral: { camera: 'ken-burns', energy: 0.05, sfxIn: null, transitionIn: 'fade', speed: 1.0, captionStyle: 'cinematic' },
      excited: { camera: 'cinematic-push', energy: 0.3, sfxIn: 'impact', transitionIn: 'fade', speed: 1.02, captionStyle: 'cinematic' },
      serious: { camera: 'slow-zoom', energy: 0.1, sfxIn: null, transitionIn: 'fade', speed: 0.98, captionStyle: 'documentary' },
      inspirational: { camera: 'cinematic-push', energy: 0.3, sfxIn: 'whoosh', transitionIn: 'fade', speed: 1.0, captionStyle: 'cinematic' },
      urgent: { camera: 'punch-in-soft', energy: 0.5, sfxIn: 'impact', transitionIn: 'cut', speed: 1.05, captionStyle: 'documentary' },
      calm: { camera: 'ken-burns', energy: 0.0, sfxIn: null, transitionIn: 'fade', speed: 0.95, captionStyle: 'cinematic' },
      playful: { camera: 'ken-burns', energy: 0.2, sfxIn: null, transitionIn: 'fade', speed: 1.0, captionStyle: 'cinematic' },
    },
  },
  {
    id: 'podcast',
    label: 'Podcast / Talking head',
    description: 'Captions a 2 líneas legibles, cámara estable, sin SFX.',
    map: {
      neutral: { camera: 'static', energy: 0.0, sfxIn: null, transitionIn: 'cut', speed: 1.0, captionStyle: 'podcast' },
      excited: { camera: 'punch-in-soft', energy: 0.2, sfxIn: null, transitionIn: 'cut', speed: 1.0, captionStyle: 'podcast' },
      serious: { camera: 'static', energy: 0.0, sfxIn: null, transitionIn: 'cut', speed: 1.0, captionStyle: 'podcast' },
      inspirational: { camera: 'slow-zoom', energy: 0.1, sfxIn: null, transitionIn: 'fade', speed: 1.0, captionStyle: 'podcast' },
      urgent: { camera: 'punch-in-soft', energy: 0.3, sfxIn: null, transitionIn: 'cut', speed: 1.0, captionStyle: 'hormozi' },
      calm: { camera: 'static', energy: 0.0, sfxIn: null, transitionIn: 'fade', speed: 1.0, captionStyle: 'podcast' },
      playful: { camera: 'punch-in-soft', energy: 0.2, sfxIn: null, transitionIn: 'cut', speed: 1.0, captionStyle: 'podcast' },
    },
  },
];

export const DEFAULT_EMOTION_PRESET_ID = 'viral';

export function getEmotionPreset(id: string): EmotionMapPreset {
  return EMOTION_PRESETS.find((p) => p.id === id) ?? EMOTION_PRESETS[0];
}
