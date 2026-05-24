/**
 * Aplicador del Auto Editing Engine sobre el proyecto activo.
 *
 *   1. Ejecuta `runAutoEdit` con el config del preset.
 *   2. Para cada escena que cambió, "carga" la versión previa (snapshot
 *      del estado anterior) en `versions[]` de la nueva escena — así el
 *      usuario puede revertir una escena específica sin perder el resto.
 *   3. Devuelve el `TimelineProject` resultante listo para `APPLY_PROJECT`.
 */
import type { Scene, TimelineProject } from '@/editing';
import { newVersionId } from '@/editing';
import { runAutoEdit, type AutoEditConfig, type AutoEditReport } from '@/editing/engine';

export interface AutoEditApplyResult {
  project: TimelineProject;
  report: AutoEditReport;
}

export function runAutoEditWithVersioning(
  project: TimelineProject,
  config: AutoEditConfig,
  options: { onlySceneId?: string; label: string } = { label: 'Auto-edit' }
): AutoEditApplyResult {
  const before = new Map(project.scenes.map((s) => [s.id, s]));
  const { project: next, report } = runAutoEdit(project, config, {
    onlySceneId: options.onlySceneId,
    presetIdLabel: options.label,
  });

  const scenes = next.scenes.map((s) => {
    const prev = before.get(s.id);
    if (!prev) return s;
    if (!sceneChanged(prev, s)) return s;
    return carryVersion(prev, s, options.label);
  });

  return {
    project: { ...next, scenes },
    report,
  };
}

function carryVersion(prev: Scene, current: Scene, label: string): Scene {
  // Snapshot del estado previo (sin recursión de versions).
  const { versions: _omit, ...snapshot } = prev;
  return {
    ...current,
    versions: [
      ...prev.versions,
      {
        id: newVersionId(),
        createdAt: new Date().toISOString(),
        reason: 'auto-edit',
        label,
        snapshot,
      },
    ].slice(-30),
  };
}

function sceneChanged(a: Scene, b: Scene): boolean {
  if (a.durationFrames !== b.durationFrames) return true;
  if (a.stylePresetId !== b.stylePresetId) return true;
  if (JSON.stringify(a.camera) !== JSON.stringify(b.camera)) return true;
  if (JSON.stringify(a.transition) !== JSON.stringify(b.transition)) return true;
  if (a.captions.length !== b.captions.length) return true;
  if (a.captions[0]?.style !== b.captions[0]?.style) return true;
  if (a.audioTracks.length !== b.audioTracks.length) return true;
  if (a.effects.length !== b.effects.length) return true;
  return false;
}
