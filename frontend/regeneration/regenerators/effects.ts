/**
 * Regenerator de efectos scene-wide — re-aplica los effects del style pack
 * activo (grain, vignette, glitch, rgb-split, …).
 *
 * Mantiene los efectos del usuario (no gestionados por style packs) intactos.
 */
import type { Scene, TimelineProject } from '@/editing';
import { getStylePack } from '@/styles';
import { newEffectId } from '@/editing';
import type { RegenContext } from './_types';

const MANAGED_KINDS = new Set([
  'grain',
  'vignette',
  'glitch',
  'rgb-split',
  'scan-lines',
  'flash',
  'speed-line',
  'shake',
]);

export function regenerateEffects(
  scene: Scene,
  project: TimelineProject,
  _ctx: RegenContext
): Partial<Scene> {
  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  const kept = scene.effects.filter((e) => !MANAGED_KINDS.has(e.kind));
  if (!pack || pack.effects.length === 0) return { effects: kept };
  const fresh = pack.effects.map((e) => ({
    id: newEffectId(e.kind),
    kind: e.kind,
    params: { ...e.params },
  }));
  return { effects: [...kept, ...fresh] };
}
