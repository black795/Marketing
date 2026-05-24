/**
 * Presets del SFX Engine — cuán "decorada" queda la escena.
 *
 *   off       → no inserta nada.
 *   minimal   → sólo en hooks + CTA.
 *   viral     → en transiciones + emociones intensas + cortes.
 *   maximalist→ casi todas las escenas con algún SFX.
 */

export interface SfxPreset {
  id: string;
  label: string;
  description: string;
  /** Si añadir SFX en la entrada de cada escena según `EmotionMap.sfxIn`. */
  emotionDriven: boolean;
  /** Si añadir SFX en transiciones (whoosh, transition). */
  transitionDriven: boolean;
  /** Roles donde siempre se añade un SFX de impacto. */
  forceOnRoles: string[];
  /** Multiplicador global de volumen 0..1. */
  volumeScale: number;
}

export const SFX_PRESETS: SfxPreset[] = [
  {
    id: 'off',
    label: 'Off',
    description: 'Sin SFX automáticos.',
    emotionDriven: false,
    transitionDriven: false,
    forceOnRoles: [],
    volumeScale: 0,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'SFX sólo en hooks y CTAs.',
    emotionDriven: false,
    transitionDriven: false,
    forceOnRoles: ['hook', 'cta'],
    volumeScale: 0.5,
  },
  {
    id: 'viral',
    label: 'Viral',
    description: 'Whoosh en transiciones + impacto en escenas intensas.',
    emotionDriven: true,
    transitionDriven: true,
    forceOnRoles: ['hook', 'cta'],
    volumeScale: 0.8,
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    description: 'SFX en casi todas las escenas — TikTok agresivo.',
    emotionDriven: true,
    transitionDriven: true,
    forceOnRoles: ['hook', 'cta', 'intro', 'outro'],
    volumeScale: 1.0,
  },
];

export function getSfxPreset(id: string): SfxPreset {
  return SFX_PRESETS.find((p) => p.id === id) ?? SFX_PRESETS[1];
}
