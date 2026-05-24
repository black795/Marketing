/**
 * Regenerator de escena entera — re-aplica el style pack activo a una sola
 * escena. Si no hay pack activo, usa TikTok Viral como fallback.
 *
 * Devuelve el `Scene` completo reemplazo; el caller decide si lo dispatcha
 * como UPDATE_SCENE o APPLY_PROJECT (este regenerator puede afectar también
 * a los frames vecinos vía recalcFrames — manejado en el runner).
 */
import type { Scene, TimelineProject } from '@/editing';
import { applyStylePack, getStylePack, STYLE_PACKS } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateScene(
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
): Partial<Scene> {
  const packId =
    (ctx.options?.stylePackId as string | undefined) ??
    scene.stylePresetId ??
    project.stylePreset?.id ??
    'tiktok-viral';
  const pack = getStylePack(packId) ?? STYLE_PACKS[0];

  const { project: next } = applyStylePack(project, pack, { onlySceneId: scene.id });
  const updated = next.scenes.find((s) => s.id === scene.id);
  if (!updated) return {};
  // Devolvemos el patch completo (sin id ni sceneNumber ni startFrame, que se preservan).
  const { id: _id, sceneNumber: _sn, startFrame: _sf, endFrame: _ef, versions: _v, ...patch } = updated;
  return patch;
}
