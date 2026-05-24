import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Luxury — transiciones suaves, timing pausado, captions tipográficos
 * elegantes, color cálido con vignette, sin SFX. Inspirado en branding
 * de moda / hospitality.
 */
const LUXURY: StylePack = {
  id: 'luxury',
  label: 'Luxury',
  emoji: '✨',
  description: 'Transiciones suaves, timing pausado, color cálido, vignette, tipografía elegante.',
  tags: ['luxury', 'fashion', 'elegant', 'cinematic', 'hospitality', 'brand'],
  autoEdit: {
    emotionMap: getEmotionPreset('cinematic'),
    timing: getTimingPreset('relaxed'),
    sfx: getSfxPreset('off'),
    captionStyleOverride: getCaptionStyle('cinematic'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: -0.05,
    contrast: 0.12,
    brightness: 0.0,
    temperature: 0.12,
    tint: 0.04,
    vignette: 0.35,
    grain: 0.04,
  },
  animations: {
    captions: { entry: 'fade', exit: 'fade', perWord: 'none' },
    clipEntry: 'fade-in',
  },
  overlays: [
    {
      id: 'luxury-watermark',
      kind: 'text',
      injectOnRoles: ['hook', 'intro', 'body', 'cta', 'outro'],
      position: { x: 0.94, y: 0.94, anchor: 'br' },
      content: { text: 'TK', size: 22, color: '#FFFFFF', opacity: 0.55, font: 'Helvetica Neue' },
      durationFrames: 9999,
      animation: { enter: 'fade' },
    },
    {
      id: 'luxury-title',
      kind: 'text',
      injectOnRoles: ['hook'],
      position: { x: 0.5, y: 0.5, anchor: 'center' },
      content: { text: 'Tim Koda', size: 52, color: '#FFFFFF', font: 'Helvetica Neue' },
      durationFrames: 60,
      animation: { enter: 'fade', exit: 'fade' },
    },
  ],
  sound: {
    sfxPresetId: 'off',
    voiceDucking: 0.1,
    musicVolume: 0.4,
    hookRiser: false,
  },
  effects: [
    { kind: 'vignette', params: { intensity: 0.35 } },
    { kind: 'grain', params: { intensity: 0.04 } },
  ],
};

export default LUXURY;
