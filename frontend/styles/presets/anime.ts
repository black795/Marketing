import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Anime — beat sync, flashes blancos, captions con bounce y color por palabra,
 * decoración kanji, color vivo, transitions tipo zoom-in/whip.
 */
const ANIME: StylePack = {
  id: 'anime',
  label: 'Anime Edit',
  emoji: '🌀',
  description: 'Flashes, kanji decorativo, captions con bounce, color vivo, cortes al beat.',
  tags: ['anime', 'manga', 'aesthetic', 'beat-sync', 'flash', 'glitch', 'kanji'],
  autoEdit: {
    emotionMap: getEmotionPreset('viral'),
    timing: getTimingPreset('tight'),
    sfx: getSfxPreset('maximalist'),
    captionStyleOverride: getCaptionStyle('tiktok'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: 0.4,
    contrast: 0.2,
    brightness: 0.05,
    temperature: 0.03,
    tint: -0.03,
    vignette: 0,
    grain: 0,
  },
  animations: {
    captions: { entry: 'bounce', exit: 'pop-out', perWord: 'color' },
    clipEntry: 'zoom-in',
  },
  overlays: [
    {
      id: 'anime-kanji-deco',
      kind: 'text',
      injectOnRoles: ['hook'],
      position: { x: 0.1, y: 0.1, anchor: 'tl' },
      content: { text: '衝撃', size: 72, color: '#FF2D8A' },
      durationFrames: 24,
      animation: { enter: 'pop', exit: 'fade' },
    },
    {
      id: 'anime-flash-frame',
      kind: 'shape',
      injectOnRoles: ['hook', 'cta'],
      position: { x: 0.5, y: 0.5, anchor: 'center' },
      content: { shape: 'white-flash', size: 1 },
      durationFrames: 3,
    },
  ],
  sound: {
    sfxPresetId: 'maximalist',
    voiceDucking: 0.3,
    musicVolume: 0.6,
    hookRiser: true,
  },
  effects: [
    { kind: 'flash', params: { frequency: 0.2 } },
    { kind: 'speed-line', params: { intensity: 0.5 } },
  ],
};

export default ANIME;
