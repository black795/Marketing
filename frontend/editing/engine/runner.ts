/**
 * Runner — orquesta los 6 engines en orden y produce un proyecto nuevo + reporte.
 *
 * Orden de ejecución importa:
 *
 *   1. Timing      — puede acortar escenas (durationFrames cambia).
 *   2. recalcFrames — todas las escenas tienen startFrame/endFrame coherente.
 *   3. Camera      — depende de la duración estabilizada.
 *   4. Transitions — necesita conocer al vecino (prev/next).
 *   5. Captions    — usa fps y endFrame ya estables.
 *   6. SFX         — necesita startFrame final (lo añade como track).
 *
 * Cada paso es opcional vía el config: `rewriteCamera` / `rewriteTransitions`
 * pueden quedar en false para respetar lo que el usuario haya editado a mano.
 *
 * Idempotencia: ejecutar dos veces con el mismo config produce el mismo
 * resultado (los presets no acumulan estado).
 */
import type { Scene, TimelineProject } from '../types';
import { recalcFrames } from '../core/scene-graph';
import {
  applyCaptionStyle,
  type CaptionStyle,
  getCaptionStyle,
} from './captions';
import {
  applyCameraPreset,
  pickCameraForScene,
} from './camera';
import {
  analyzeTiming,
  applyTimingToScene,
  type TimingAnalysis,
} from './timing';
import {
  analyzeSfxForScene,
  applySfxToScene,
  getSfx,
} from './sfx';
import { pickTransitionIn, getTransition } from './transitions';
import { getDirectives } from './emotion';
import type { AutoEditConfig } from './presets';

export interface AutoEditReport {
  presetUsedId: string;
  scenesProcessed: number;
  timing: TimingAnalysis;
  cameraChanges: { sceneId: string; presetId: string }[];
  transitionChanges: { sceneId: string; transitionId: string }[];
  captionsRewritten: number;
  sfxInserted: number;
}

export interface RunOptions {
  /** Si se pasa, sólo procesa esa escena (regen modular). */
  onlySceneId?: string;
  presetIdLabel?: string;
}

export function runAutoEdit(
  project: TimelineProject,
  config: AutoEditConfig,
  options: RunOptions = {}
): { project: TimelineProject; report: AutoEditReport } {
  const fps = project.renderConfig.fps;

  // ---- 1. Timing (puede mutar durationFrames) ----------------------------
  const timing = analyzeTiming(project, config.timing);
  let scenes = project.scenes.map((s) => {
    if (options.onlySceneId && s.id !== options.onlySceneId) return s;
    return applyTimingToScene(s, timing.operations);
  });

  // ---- 2. Recalcular frames tras posibles trims --------------------------
  scenes = recalcFrames(scenes);

  // ---- 3. Cámara por escena ----------------------------------------------
  const cameraChanges: AutoEditReport['cameraChanges'] = [];
  if (config.rewriteCamera) {
    scenes = scenes.map((s) => {
      if (options.onlySceneId && s.id !== options.onlySceneId) return s;
      const presetId = pickCameraForScene(s, config.emotionMap.map);
      const { camera, effects } = applyCameraPreset(s, presetId);
      cameraChanges.push({ sceneId: s.id, presetId });
      return {
        ...s,
        camera,
        effects: mergeEffectsByKind(s.effects, effects),
      };
    });
  }

  // ---- 4. Transiciones de entrada ----------------------------------------
  const transitionChanges: AutoEditReport['transitionChanges'] = [];
  if (config.rewriteTransitions) {
    scenes = scenes.map((s, i, arr) => {
      if (options.onlySceneId && s.id !== options.onlySceneId) return s;
      const prev = i > 0 ? arr[i - 1] : null;
      const id = pickTransitionIn(s, prev, config.emotionMap.map);
      const tp = getTransition(id);
      transitionChanges.push({ sceneId: s.id, transitionId: id });
      return {
        ...s,
        transition: {
          ...s.transition,
          inKind: tp.kind,
          inDurationFrames: tp.defaultDurationFrames,
        },
      };
    });
  }

  // ---- 5. Captions -------------------------------------------------------
  let captionsRewritten = 0;
  scenes = scenes.map((s) => {
    if (options.onlySceneId && s.id !== options.onlySceneId) return s;
    if (s.captions.length === 0) return s;
    const style = pickCaptionStyle(s, config);
    const newCaptions = applyCaptionStyle(s, { style });
    captionsRewritten += 1;
    return {
      ...s,
      captions: newCaptions,
      stylePresetId: style.id,
    };
  });

  // ---- 6. SFX ------------------------------------------------------------
  let sfxInserted = 0;
  scenes = scenes.map((s) => {
    if (options.onlySceneId && s.id !== options.onlySceneId) return s;
    const insertions = analyzeSfxForScene(
      s,
      config.sfx,
      config.emotionMap.map,
      // defaultVolume: usamos el del primer SFX disponible, o 0.6 si no hay.
      getSfx('whoosh')?.defaultVolume ?? 0.6
    );
    if (insertions.length === 0) return s;
    sfxInserted += insertions.length;
    return applySfxToScene(s, insertions);
  });

  // Marca renderState 'stale' en las escenas modificadas (la UI lo verá como
  // "modificado" — el render previo ya no refleja el contenido).
  scenes = scenes.map((s) => {
    if (options.onlySceneId && s.id !== options.onlySceneId) return s;
    return s.renderState === 'ready' ? { ...s, renderState: 'stale' as const } : s;
  });

  const nextProject: TimelineProject = {
    ...project,
    scenes,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...project.metadata,
      sceneCount: scenes.length,
      durationFrames: scenes
        .filter((s) => s.included)
        .reduce((a, b) => a + b.durationFrames, 0),
    },
  };

  return {
    project: nextProject,
    report: {
      presetUsedId: options.presetIdLabel ?? 'custom',
      scenesProcessed: options.onlySceneId ? 1 : scenes.length,
      timing,
      cameraChanges,
      transitionChanges,
      captionsRewritten,
      sfxInserted,
    },
  };
}

function pickCaptionStyle(scene: Scene, config: AutoEditConfig): CaptionStyle {
  if (config.captionStyleOverride) return config.captionStyleOverride;
  const dir = getDirectives(config.emotionMap.map, scene.emotion);
  return getCaptionStyle(dir.captionStyle);
}

function mergeEffectsByKind<T extends { kind: string }>(
  base: T[],
  incoming: T[]
): T[] {
  if (incoming.length === 0) return base;
  const kinds = new Set(incoming.map((e) => e.kind));
  return [...base.filter((e) => !kinds.has(e.kind)), ...incoming];
}
