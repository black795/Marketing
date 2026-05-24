/**
 * Presets combinados del Auto Editing Engine.
 *
 * Cada uno empaqueta una elección de los 6 sub-presets para que el usuario
 * elija "TikTok Viral" / "Podcast Clip" con un solo click y arrastre todas
 * las consecuencias coherentemente.
 */
import type { EmotionMapPreset } from './emotion';
import { getEmotionPreset } from './emotion';
import type { TimingPreset } from './timing';
import { getTimingPreset } from './timing';
import type { SfxPreset } from './sfx';
import { getSfxPreset } from './sfx';
import type { CaptionStyle } from './captions';
import { getCaptionStyle } from './captions';

export interface AutoEditConfig {
  emotionMap: EmotionMapPreset;
  timing: TimingPreset;
  sfx: SfxPreset;
  /** Override del estilo de caption. Si null, el engine usa el sugerido por la emoción. */
  captionStyleOverride: CaptionStyle | null;
  /** Si true, recalcula la cámara por escena. */
  rewriteCamera: boolean;
  /** Si true, reescribe las transiciones entre escenas. */
  rewriteTransitions: boolean;
}

export interface AutoEditPreset {
  id: string;
  label: string;
  description: string;
  emoji: string;
  config: AutoEditConfig;
}

export const AUTO_EDIT_PRESETS: AutoEditPreset[] = [
  {
    id: 'tiktok-viral',
    label: 'TikTok Viral',
    description: 'Energía alta, hook acelerado, captions estilo TikTok, SFX agresivos.',
    emoji: '🔥',
    config: {
      emotionMap: getEmotionPreset('viral'),
      timing: getTimingPreset('tight'),
      sfx: getSfxPreset('viral'),
      captionStyleOverride: null,
      rewriteCamera: true,
      rewriteTransitions: true,
    },
  },
  {
    id: 'hormozi-style',
    label: 'Hormozi style',
    description: 'Captions ALL CAPS amarillo, cortes secos, mensaje primero.',
    emoji: '💰',
    config: {
      emotionMap: getEmotionPreset('viral'),
      timing: getTimingPreset('tight'),
      sfx: getSfxPreset('minimal'),
      captionStyleOverride: getCaptionStyle('hormozi'),
      rewriteCamera: true,
      rewriteTransitions: false,
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematográfico',
    description: 'Pacing lento, captions mínimos, fundidos, sin SFX.',
    emoji: '🎬',
    config: {
      emotionMap: getEmotionPreset('cinematic'),
      timing: getTimingPreset('relaxed'),
      sfx: getSfxPreset('off'),
      captionStyleOverride: getCaptionStyle('cinematic'),
      rewriteCamera: true,
      rewriteTransitions: true,
    },
  },
  {
    id: 'podcast-clip',
    label: 'Podcast clip',
    description: 'Talking head: captions a 2 líneas, sin movimiento, sin SFX.',
    emoji: '🎙️',
    config: {
      emotionMap: getEmotionPreset('podcast'),
      timing: getTimingPreset('balanced'),
      sfx: getSfxPreset('off'),
      captionStyleOverride: getCaptionStyle('podcast'),
      rewriteCamera: false,
      rewriteTransitions: false,
    },
  },
  {
    id: 'documentary',
    label: 'Documental',
    description: 'Lower-thirds clásicos, Ken Burns, fundidos suaves.',
    emoji: '📽️',
    config: {
      emotionMap: getEmotionPreset('cinematic'),
      timing: getTimingPreset('balanced'),
      sfx: getSfxPreset('minimal'),
      captionStyleOverride: getCaptionStyle('documentary'),
      rewriteCamera: true,
      rewriteTransitions: true,
    },
  },
];

export function getAutoEditPreset(id: string): AutoEditPreset {
  return AUTO_EDIT_PRESETS.find((p) => p.id === id) ?? AUTO_EDIT_PRESETS[0];
}
