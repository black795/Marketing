import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Hormozi — captions ALL CAPS amarillos, foco en el mensaje, cero adornos.
 * Cortes secos, SFX mínimo en hooks/CTAs, sin transiciones flashy.
 */
const HORMOZI: StylePack = {
  id: 'hormozi',
  label: 'Hormozi',
  emoji: '💰',
  description: 'Captions ALL CAPS amarillos, énfasis en cada palabra clave, sin adornos.',
  tags: ['hormozi', 'money', 'business', 'caps', 'emphasis', 'clean'],
  autoEdit: {
    emotionMap: getEmotionPreset('viral'),
    timing: getTimingPreset('tight'),
    sfx: getSfxPreset('minimal'),
    captionStyleOverride: getCaptionStyle('hormozi'),
    rewriteCamera: true,
    rewriteTransitions: false,
  },
  colorGrade: {
    saturation: 0.05,
    contrast: 0.2,
    brightness: 0.05,
    temperature: 0.08,
    tint: 0,
    vignette: 0,
    grain: 0,
  },
  animations: {
    captions: { entry: 'pop', exit: 'fade', perWord: 'scale' },
    clipEntry: 'punch-in',
  },
  overlays: [],
  sound: {
    sfxPresetId: 'minimal',
    voiceDucking: 0.2,
    musicVolume: 0.25,
    hookRiser: false,
  },
  effects: [],
};

export default HORMOZI;
