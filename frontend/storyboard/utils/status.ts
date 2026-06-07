/**
 * Mapeo del `RenderState` técnico (editing/types) a la etiqueta UI del usuario.
 *
 *   pending     → "pending"      (gris)
 *   building    → "generating"   (azul, pulsa)
 *   ready       → "rendered"     (verde)
 *   stale       → "modified"     (amarillo)  — el contenido cambió tras renderizar
 *   failed      → "failed"       (rojo)
 *
 * `regenerating` es una variante de `building` que el UI usa cuando hay
 * historial previo (al menos 1 versión); se diferencia visualmente.
 */
import type { RenderState, Scene } from '@/editing';
import type { SceneStatusUi } from '../types/ui';

export function sceneStatusUi(scene: Scene): SceneStatusUi {
  switch (scene.renderState) {
    case 'pending':
      return 'pending';
    case 'building':
      return scene.versions.length > 0 ? 'regenerating' : 'generating';
    case 'ready':
      return 'rendered';
    case 'stale':
      return 'modified';
    case 'failed':
      return 'failed';
  }
}

export function statusLabel(status: SceneStatusUi): string {
  return {
    pending: 'pendiente',
    generating: 'generando',
    regenerating: 'regenerando',
    rendered: 'listo',
    modified: 'modificado',
    failed: 'falló',
  }[status];
}

export function statusColor(status: SceneStatusUi): {
  bg: string;
  text: string;
  ring: string;
} {
  switch (status) {
    case 'pending':
      return { bg: 'bg-[var(--bg-3)]', text: 'text-[var(--fg-2)]', ring: 'ring-[var(--line)]' };
    case 'generating':
    case 'regenerating':
      return { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' };
    case 'rendered':
      return { bg: 'bg-[var(--success-soft)]', text: 'text-[var(--success)]', ring: 'ring-[rgba(43,212,164,0.3)]' };
    case 'modified':
      return { bg: 'bg-[var(--warning-soft)]', text: 'text-[var(--warning)]', ring: 'ring-[rgba(245,181,68,0.3)]' };
    case 'failed':
      return { bg: 'bg-[var(--red-soft)]', text: 'text-[var(--red-hi)]', ring: 'ring-[var(--red-ring)]' };
  }
}

/** Próximo `RenderState` cuando el usuario modifica una escena ya renderizada. */
export function bumpToStaleIfRendered(prev: RenderState): RenderState {
  return prev === 'ready' ? 'stale' : prev;
}
