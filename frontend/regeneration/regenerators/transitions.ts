/**
 * Regenerator de transición de entrada — usa pickTransitionIn con el
 * EmotionMap activo y la escena previa (si existe) para decidir la energía.
 */
import type { Scene, TimelineProject } from '@/editing';
import { pickTransitionIn, getTransition, getEmotionPreset } from '@/editing/engine';
import { getStylePack } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateTransition(
  scene: Scene,
  project: TimelineProject,
  _ctx: RegenContext
): Partial<Scene> {
  const idx = project.scenes.findIndex((s) => s.id === scene.id);
  const previous = idx > 0 ? project.scenes[idx - 1] : null;

  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  const emotionMap = pack?.autoEdit.emotionMap.map ?? getEmotionPreset('viral').map;

  const id = pickTransitionIn(scene, previous, emotionMap);
  const tp = getTransition(id);
  return {
    transition: {
      ...scene.transition,
      inKind: tp.kind,
      inDurationFrames: tp.defaultDurationFrames,
    },
  };
}
