/**
 * Regenerator de overlays — re-inyecta los OverlayTemplate del style pack
 * activo aplicables a esta escena (según rol).
 */
import type { Scene, TimelineProject } from '@/editing';
import { getStylePack, injectOverlays } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateOverlays(
  scene: Scene,
  project: TimelineProject,
  _ctx: RegenContext
): Partial<Scene> {
  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  if (!pack || pack.overlays.length === 0) {
    return { overlays: scene.overlays.filter((o) => !isTemplated(o)) };
  }
  const next = injectOverlays(scene, pack.overlays);
  return { overlays: next.overlays };
}

function isTemplated(overlay: { content: Record<string, unknown> }): boolean {
  return (
    overlay.content !== null &&
    typeof overlay.content === 'object' &&
    '__templateId' in overlay.content
  );
}
