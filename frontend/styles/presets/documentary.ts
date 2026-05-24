import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Documentary — pacing relajado, lower-thirds clásicos, color cinematográfico
 * desaturado, grain sutil, transiciones de fundido.
 */
const DOCUMENTARY: StylePack = {
  id: 'documentary',
  label: 'Documentary',
  emoji: '📽️',
  description: 'Lower-thirds clásicos, color desaturado, grain sutil, fundidos.',
  tags: ['documentary', 'film', 'lower-third', 'narrative', 'editorial'],
  autoEdit: {
    emotionMap: getEmotionPreset('cinematic'),
    timing: getTimingPreset('balanced'),
    sfx: getSfxPreset('minimal'),
    captionStyleOverride: getCaptionStyle('documentary'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: -0.12,
    contrast: 0.15,
    brightness: -0.02,
    temperature: -0.05,
    tint: 0.02,
    vignette: 0.25,
    grain: 0.12,
  },
  animations: {
    captions: { entry: 'fade', exit: 'fade', perWord: 'none' },
    clipEntry: 'fade-in',
  },
  overlays: [
    {
      id: 'doc-title-card',
      kind: 'text',
      injectOnRoles: ['hook'],
      position: { x: 0.5, y: 0.5, anchor: 'center' },
      content: { text: 'CAPÍTULO 1', size: 64, color: '#FFFFFF', font: 'Georgia' },
      durationFrames: 60,
      animation: { enter: 'fade', exit: 'fade' },
    },
    {
      id: 'doc-byline',
      kind: 'text',
      injectOnRoles: ['intro'],
      position: { x: 0.06, y: 0.86, anchor: 'tl' },
      content: { text: 'Una historia de Tim Koda', size: 32, color: '#FFFFFF' },
      durationFrames: 90,
      animation: { enter: 'fade', exit: 'fade' },
    },
  ],
  sound: {
    sfxPresetId: 'minimal',
    voiceDucking: 0.15,
    musicVolume: 0.35,
    hookRiser: false,
  },
  effects: [
    { kind: 'grain', params: { intensity: 0.12 } },
    { kind: 'vignette', params: { intensity: 0.25 } },
  ],
};

export default DOCUMENTARY;
