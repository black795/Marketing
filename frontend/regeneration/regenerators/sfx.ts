/**
 * Regenerator de SFX — re-elige y materializa los SFX de la escena según
 * el SfxPreset activo, EmotionMap, rol y transición.
 */
import type { Scene, TimelineProject } from '@/editing';
import {
  analyzeSfxForScene,
  applySfxToScene,
  getEmotionPreset,
  getSfx,
  getSfxPreset,
} from '@/editing/engine';
import { getStylePack } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateSfx(
  scene: Scene,
  project: TimelineProject,
  _ctx: RegenContext
): Partial<Scene> {
  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  const sfxPreset = pack?.autoEdit.sfx ?? getSfxPreset('viral');
  const emotionMap = pack?.autoEdit.emotionMap.map ?? getEmotionPreset('viral').map;
  const defaultVolume = getSfx('whoosh')?.defaultVolume ?? 0.6;

  const insertions = analyzeSfxForScene(scene, sfxPreset, emotionMap, defaultVolume);
  const next = applySfxToScene(scene, insertions);
  return { audioTracks: next.audioTracks };
}
