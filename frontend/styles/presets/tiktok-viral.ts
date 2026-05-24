import {
  getEmotionPreset,
  getTimingPreset,
  getSfxPreset,
  getCaptionStyle,
} from '@/editing/engine';
import type { StylePack } from '../configs/style-pack';

/**
 * TikTok Viral — el preset bandera. Cortes rápidos, captions agresivos,
 * SFX en todas las transiciones, hook acelerado, emojis automáticos.
 */
const TIKTOK_VIRAL: StylePack = {
  id: 'tiktok-viral',
  label: 'TikTok Viral',
  emoji: '🔥',
  description: 'Cortes 1-2s, captions amarillos enormes, SFX en cada transición, emoji auto.',
  tags: ['viral', 'tiktok', 'fast', 'short', 'reels', 'hook'],
  autoEdit: {
    emotionMap: getEmotionPreset('viral'),
    timing: getTimingPreset('tight'),
    sfx: getSfxPreset('viral'),
    captionStyleOverride: getCaptionStyle('tiktok'),
    rewriteCamera: true,
    rewriteTransitions: true,
  },
  colorGrade: {
    saturation: 0.18,
    contrast: 0.12,
    brightness: 0.05,
    temperature: 0.05,
    tint: 0,
    vignette: 0,
    grain: 0,
  },
  animations: {
    captions: { entry: 'pop', exit: 'pop-out', perWord: 'color' },
    clipEntry: 'punch-in',
  },
  overlays: [
    {
      id: 'tiktok-hook-emoji',
      kind: 'text',
      injectOnRoles: ['hook'],
      position: { x: 0.5, y: 0.18, anchor: 'tc' },
      content: { text: '🔥', size: 120, color: '#FFF466' },
      durationFrames: 12,
      animation: { enter: 'pop', exit: 'fade' },
    },
    {
      id: 'tiktok-cta-arrow',
      kind: 'text',
      injectOnRoles: ['cta'],
      position: { x: 0.5, y: 0.7, anchor: 'tc' },
      content: { text: '👇 sigue', size: 56, color: '#FFFFFF' },
      durationFrames: 40,
      animation: { enter: 'pop', exit: 'fade' },
    },
  ],
  sound: {
    sfxPresetId: 'viral',
    voiceDucking: 0.3,
    musicVolume: 0.5,
    hookRiser: true,
  },
  effects: [
    { kind: 'shake', params: { intensity: 0.15, frequency: 6 } },
  ],
};

export default TIKTOK_VIRAL;
