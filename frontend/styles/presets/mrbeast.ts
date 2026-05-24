import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * MrBeast — energía altísima sostenida. Zooms agresivos, sound design ruidoso,
 * countdown en hooks, colores POP, reacciones puntuadas con SFX.
 */
const MRBEAST: StylePack = {
  id: 'mrbeast',
  label: 'MrBeast',
  emoji: '🤯',
  description: 'Energía alta sostenida, zooms agresivos, countdown, colores POP, SFX en cada beat.',
  tags: ['mrbeast', 'high-energy', 'punch', 'reactions', 'big-numbers'],
  autoEdit: {
    emotionMap: getEmotionPreset('viral'),
    timing: getTimingPreset('tight'),
    sfx: getSfxPreset('maximalist'),
    captionStyleOverride: getCaptionStyle('tiktok'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: 0.25,
    contrast: 0.15,
    brightness: 0.1,
    temperature: 0.05,
    tint: 0,
    vignette: 0,
    grain: 0,
  },
  animations: {
    captions: { entry: 'bounce', exit: 'pop-out', perWord: 'scale' },
    clipEntry: 'punch-in',
  },
  overlays: [
    {
      id: 'mrbeast-countdown',
      kind: 'text',
      injectOnRoles: ['hook'],
      position: { x: 0.5, y: 0.15, anchor: 'tc' },
      content: { text: '3 · 2 · 1', size: 96, color: '#FF2D8A' },
      durationFrames: 24,
      animation: { enter: 'pop', exit: 'pop' },
    },
    {
      id: 'mrbeast-cta-big',
      kind: 'text',
      injectOnRoles: ['cta'],
      position: { x: 0.5, y: 0.6, anchor: 'tc' },
      content: { text: 'SUBSCRIBE', size: 110, color: '#FFFFFF' },
      durationFrames: 50,
      animation: { enter: 'pop', exit: 'fade' },
    },
  ],
  sound: {
    sfxPresetId: 'maximalist',
    voiceDucking: 0.35,
    musicVolume: 0.55,
    hookRiser: true,
  },
  effects: [
    { kind: 'shake', params: { intensity: 0.3, frequency: 10 } },
  ],
};

export default MRBEAST;
