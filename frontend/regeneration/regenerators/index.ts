/**
 * Despachador — mapea cada `RegenTarget` a su función regeneradora.
 *
 *   import { REGENERATORS } from '@/regeneration';
 *   const patch = REGENERATORS[job.target](scene, project, { options });
 */
import type { RegenTarget } from '../types/job';
import type { Regenerator } from './_types';
import { regenerateCaptions } from './captions';
import { regenerateCamera } from './camera';
import { regenerateTransition } from './transitions';
import { regenerateOverlays } from './overlays';
import { regenerateEffects } from './effects';
import { regenerateSfx } from './sfx';
import { regenerateVoice } from './voice';
import { regenerateMusic } from './music';
import { regenerateScene } from './scene';

export const REGENERATORS: Record<RegenTarget, Regenerator> = {
  captions: regenerateCaptions,
  camera: regenerateCamera,
  transitions: regenerateTransition,
  overlays: regenerateOverlays,
  effects: regenerateEffects,
  sfx: regenerateSfx,
  voice: regenerateVoice,
  music: regenerateMusic,
  scene: regenerateScene,
};

export type { Regenerator, RegenContext } from './_types';
