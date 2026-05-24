import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * Gaming — RGB / glitch / HUD style. Cortes urgentes, SFX agresivo, colores
 * saturados con tinte azul/púrpura, captions con bounce, glitch en transiciones.
 */
const GAMING: StylePack = {
  id: 'gaming',
  label: 'Gaming',
  emoji: '🎮',
  description: 'Glitch RGB, HUD overlays, SFX impacto, captions con bounce, color saturado cool.',
  tags: ['gaming', 'gamer', 'glitch', 'rgb', 'hud', 'twitch', 'esports'],
  autoEdit: {
    emotionMap: getEmotionPreset('viral'),
    timing: getTimingPreset('tight'),
    sfx: getSfxPreset('maximalist'),
    captionStyleOverride: getCaptionStyle('tiktok'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: 0.3,
    contrast: 0.25,
    brightness: 0.0,
    temperature: -0.15,
    tint: -0.05,
    vignette: 0.15,
    grain: 0.05,
  },
  animations: {
    captions: { entry: 'slide-up', exit: 'pop-out', perWord: 'bounce' },
    clipEntry: 'zoom-in',
  },
  overlays: [
    {
      id: 'gaming-hud-corner',
      kind: 'text',
      injectOnRoles: ['hook', 'body', 'cta'],
      position: { x: 0.04, y: 0.04, anchor: 'tl' },
      content: { text: 'HP 100', size: 28, color: '#00FF88' },
      durationFrames: 9999,
      animation: { enter: 'fade' },
    },
    {
      id: 'gaming-glitch-flash',
      kind: 'shape',
      injectOnRoles: ['hook'],
      position: { x: 0.5, y: 0.5, anchor: 'center' },
      content: { shape: 'rgb-glitch', size: 1 },
      durationFrames: 4,
    },
  ],
  sound: {
    sfxPresetId: 'maximalist',
    voiceDucking: 0.3,
    musicVolume: 0.45,
    hookRiser: true,
  },
  effects: [
    { kind: 'rgb-split', params: { intensity: 0.4 } },
    { kind: 'glitch', params: { frequency: 0.3 } },
    { kind: 'scan-lines', params: { opacity: 0.08 } },
  ],
};

export default GAMING;
