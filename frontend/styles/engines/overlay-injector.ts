/**
 * Inyecta los OverlayTemplate del StylePack como `SceneOverlay` reales
 * en cada escena cuyo rol coincide.
 *
 * Comportamiento idempotente: si una escena ya tiene un overlay con el
 * mismo id semilla (`templateId`), se reemplaza en lugar de duplicar.
 * Eso permite cambiar de StylePack varias veces sin acumular overlays.
 */
import type { Scene, SceneOverlay } from '@/editing';
import { newOverlayId } from '@/editing';
import type { OverlayTemplate } from '../configs/overlays';

/** Marca que dejamos en `content.__templateId` para detectar y reemplazar. */
const TEMPLATE_MARK = '__templateId';

function clampDuration(scene: Scene, raw: number): number {
  // Overlays con durationFrames muy grandes (9999) significan "toda la escena".
  return Math.min(raw, scene.durationFrames);
}

function materializeOverlay(scene: Scene, template: OverlayTemplate): SceneOverlay {
  const duration = clampDuration(scene, template.durationFrames);
  return {
    id: newOverlayId(),
    kind: template.kind === 'image' ? 'image' : template.kind,
    startFrame: scene.startFrame,
    endFrame: scene.startFrame + duration,
    position: { ...template.position },
    content: { ...template.content, [TEMPLATE_MARK]: template.id },
    animation: template.animation,
  };
}

export function injectOverlays(scene: Scene, templates: OverlayTemplate[]): Scene {
  const matching = templates.filter((t) => t.injectOnRoles.includes(scene.role));
  if (matching.length === 0) {
    // También removemos overlays previos del style pack (id semilla) en escenas
    // donde el nuevo pack ya no inyecta — evita basura tras cambiar de estilo.
    return removeTemplatedOverlays(scene);
  }

  const stripped = removeTemplatedOverlays(scene);
  const newOverlays = matching.map((t) => materializeOverlay(scene, t));
  return {
    ...stripped,
    overlays: [...stripped.overlays, ...newOverlays],
  };
}

function removeTemplatedOverlays(scene: Scene): Scene {
  const kept = scene.overlays.filter(
    (o) => !(o.content && typeof o.content === 'object' && TEMPLATE_MARK in o.content)
  );
  if (kept.length === scene.overlays.length) return scene;
  return { ...scene, overlays: kept };
}
