/**
 * Versionado de escenas — base del historial inmutable.
 *
 * `pushVersion` toma una escena, congela su estado actual como `SceneVersion`
 * y devuelve la escena con la nueva versión añadida al final del array.
 * `revertToVersion` toma una versión existente y devuelve la escena
 * restaurada (manteniendo el historial completo).
 *
 * El historial se acota a `MAX_VERSIONS` para no inflar el JSON; las versiones
 * más antiguas se descartan en FIFO.
 */
import type { Scene, SceneVersion } from '../types/scene';
import { newVersionId } from '../utils/ids';

const MAX_VERSIONS = 30;

export function pushVersion(scene: Scene, reason: string, label?: string): Scene {
  const { versions: _omit, ...snapshot } = scene;
  const next: SceneVersion = {
    id: newVersionId(),
    createdAt: new Date().toISOString(),
    reason,
    label,
    snapshot,
  };
  const versions = [...scene.versions, next].slice(-MAX_VERSIONS);
  return { ...scene, versions };
}

export function revertToVersion(scene: Scene, versionId: string): Scene {
  const v = scene.versions.find((x) => x.id === versionId);
  if (!v) return scene;
  // Mantenemos el historial vivo y añadimos un marcador del revert.
  const restored: Scene = { ...v.snapshot, versions: scene.versions };
  return pushVersion(restored, 'revert', `Revertido a ${v.label ?? v.id}`);
}

export function latestVersion(scene: Scene): SceneVersion | null {
  return scene.versions.length === 0 ? null : scene.versions[scene.versions.length - 1];
}
