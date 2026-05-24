import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Podcast — talking head clean. Captions a 2 líneas legibles, cámara estática
 * o punch-in muy suave, sin SFX, foco en el habla.
 */
const PODCAST: StylePack = {
  id: 'podcast',
  label: 'Podcast',
  emoji: '🎙️',
  description: 'Captions limpios a 2 líneas, sin SFX, cámara estable, color neutro.',
  tags: ['podcast', 'talking', 'clean', 'lower-third', 'speaker'],
  autoEdit: {
    emotionMap: getEmotionPreset('podcast'),
    timing: getTimingPreset('balanced'),
    sfx: getSfxPreset('off'),
    captionStyleOverride: getCaptionStyle('podcast'),
    rewriteCamera: false,
    rewriteTransitions: false,
  },
  colorGrade: {
    saturation: 0.0,
    contrast: 0.05,
    brightness: 0.02,
    temperature: 0.02,
    tint: 0,
    vignette: 0.1,
    grain: 0,
  },
  animations: {
    captions: { entry: 'fade', exit: 'fade', perWord: 'none' },
    clipEntry: 'cut',
  },
  overlays: [
    {
      id: 'podcast-lower-third',
      kind: 'text',
      injectOnRoles: ['intro'],
      position: { x: 0.06, y: 0.8, anchor: 'tl' },
      content: { text: 'Tim Koda · Episode', size: 38, color: '#FFFFFF' },
      durationFrames: 90,
      animation: { enter: 'slide', exit: 'fade' },
    },
  ],
  sound: {
    sfxPresetId: 'off',
    voiceDucking: 0.0,
    musicVolume: 0.15,
    hookRiser: false,
  },
  effects: [],
};

export default PODCAST;
