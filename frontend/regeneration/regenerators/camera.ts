/**
 * Regenerator de cámara — recomputa preset de cámara por escena usando el
 * EmotionMap activo (del style pack si hay; viral por defecto).
 */
import type { Scene, TimelineProject } from '@/editing';
import { pickCameraForScene, applyCameraPreset, getEmotionPreset } from '@/editing/engine';
import { getStylePack } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateCamera(
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
): Partial<Scene> {
  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  const emotionMap = pack?.autoEdit.emotionMap.map ?? getEmotionPreset('viral').map;

  const presetId = (ctx.options?.cameraPresetId as string | undefined)
    ?? pickCameraForScene(scene, emotionMap);

  const { camera, effects } = applyCameraPreset(scene, presetId);
  // Fusión: efectos nuevos sobreescriben los del mismo kind.
  const kinds = new Set(effects.map((e) => e.kind));
  const merged = [
    ...scene.effects.filter((e) => !kinds.has(e.kind)),
    ...effects,
  ];
  return { camera, effects: merged };
}
