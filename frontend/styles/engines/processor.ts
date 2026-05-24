/**
 * Processor — aplica un `StylePack` completo a un `TimelineProject`.
 *
 * Orquesta dos capas:
 *
 *   1. runAutoEdit(autoEdit) — el Auto Editing Engine (captions, camera,
 *      timing, sfx, transitions, emotion) ya entrega un proyecto base.
 *
 *   2. Sobre ese resultado, añade el Style Engine puro:
 *      - color grade en cada escena
 *      - animations (caption + clip)
 *      - overlays inyectados por rol
 *      - scene-wide effects (grain, vignette, glitch, …)
 *
 * Idempotente: aplicar 2× el mismo pack da el mismo resultado. Cambiar de
 * pack reemplaza overlays "templated" y los effects propios — no acumula.
 *
 * Compatible con SceneGraph + TimelineProject + autosave (el caller pasa
 * el output a APPLY_PROJECT y el render lee los SceneEffect nuevos).
 */
import type { Scene, TimelineProject } from '@/editing';
import { newEffectId } from '@/editing';
import { runAutoEdit, type AutoEditReport } from '@/editing/engine';
import type { StylePack, SceneWideEffect } from '../configs/style-pack';
import { applyColorGrade } from './color-grade-applier';
import { applyAnimations } from './animation-applier';
import { injectOverlays } from './overlay-injector';

export interface StylePackReport {
  packId: string;
  packLabel: string;
  scenesProcessed: number;
  overlaysInjected: number;
  effectsAdded: number;
  autoEdit: AutoEditReport;
}

export interface ApplyOptions {
  onlySceneId?: string;
}

export interface ApplyResult {
  project: TimelineProject;
  report: StylePackReport;
}

/** Kinds gestionados por el processor — los reemplazamos, no los acumulamos. */
const MANAGED_EFFECT_KINDS = new Set([
  'color-grade',
  'caption-animation',
  'clip-animation',
  // scene-wide:
  'grain',
  'vignette',
  'glitch',
  'rgb-split',
  'scan-lines',
  'flash',
  'speed-line',
  'shake',
]);

function applySceneWideEffects(scene: Scene, effects: SceneWideEffect[]): Scene {
  // 1) Quitar los efectos previos que el processor gestiona.
  const kept = scene.effects.filter((e) => !MANAGED_EFFECT_KINDS.has(e.kind));
  // 2) Añadir los nuevos (pueden venir vacíos para limpiar).
  const fresh = effects.map((e) => ({
    id: newEffectId(e.kind),
    kind: e.kind,
    params: { ...e.params },
  }));
  return { ...scene, effects: [...kept, ...fresh] };
}

export function applyStylePack(
  project: TimelineProject,
  pack: StylePack,
  options: ApplyOptions = {}
): ApplyResult {
  // 1) Auto editing engine — reescribe captions, camera, transitions, etc.
  const autoOut = runAutoEdit(project, pack.autoEdit, {
    onlySceneId: options.onlySceneId,
    presetIdLabel: `${pack.emoji} ${pack.label}`,
  });

  let overlaysInjected = 0;
  let effectsAdded = 0;

  // 2) Capa Style Engine — para cada escena (o sólo la pedida).
  const scenes: Scene[] = autoOut.project.scenes.map((s) => {
    if (options.onlySceneId && s.id !== options.onlySceneId) return s;

    let next = s;

    // Scene-wide effects (incluye el set vacío → limpieza coherente).
    const beforeFx = next.effects.length;
    next = applySceneWideEffects(next, pack.effects);
    effectsAdded += Math.max(0, next.effects.length - beforeFx);

    // Animations (caption + clip).
    next = applyAnimations(next, pack.animations);

    // Color grade.
    next = applyColorGrade(next, pack.colorGrade);

    // Overlay templates → SceneOverlay.
    const beforeOv = next.overlays.length;
    next = injectOverlays(next, pack.overlays);
    overlaysInjected += Math.max(0, next.overlays.length - beforeOv);

    // Marcamos como stale si quedó renderizada — refleja que el render previo
    // ya no representa el contenido.
    if (next.renderState === 'ready') {
      next = { ...next, renderState: 'stale' };
    }
    // Guardamos el id del pack en stylePresetId (override).
    next = { ...next, stylePresetId: pack.id };
    return next;
  });

  const nextProject: TimelineProject = {
    ...autoOut.project,
    scenes,
    stylePreset: {
      id: pack.id,
      label: pack.label,
      description: pack.description,
      params: {
        emoji: pack.emoji,
        tags: pack.tags,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    project: nextProject,
    report: {
      packId: pack.id,
      packLabel: `${pack.emoji} ${pack.label}`,
      scenesProcessed: options.onlySceneId ? 1 : scenes.length,
      overlaysInjected,
      effectsAdded,
      autoEdit: autoOut.report,
    },
  };
}
