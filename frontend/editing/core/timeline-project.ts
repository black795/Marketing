/**
 * TimelineProject — fábrica + conversiones con el TimelineDocument legacy.
 *
 *   `emptyProject(projectId)`           → un proyecto en blanco con defaults sensatos.
 *   `fromTimelineDocument(doc, plan?)`  → deriva un TimelineProject del timeline.json.
 *   `toTimelineDocument(project)`       → reconstruye un timeline.json a partir del graph.
 *
 * El backend de render hoy consume el timeline.json legacy. El editor visual
 * y todo lo nuevo opera sobre `TimelineProject`. La conversión es bidireccional:
 * cuando el usuario guarda, escribimos AMBOS — el graph rico Y el documento legacy
 * coherente — para que el render siga funcionando sin tocar su pipeline.
 */
import type { TimelineDocument } from '@/types/timeline';
import type { EditPlan } from '@/types/edit-plan';
import type { TimelineProject, RenderConfig } from '../types/project';
import type { Scene } from '../types/scene';
import { defaultTracks } from '../types/tracks';
import { fromTimelineDocument as buildScenesFromDoc } from '../scenes/builder';
import { recalcFrames, totalDurationFrames } from './scene-graph';
import { getStylePreset } from './style-presets';

function defaultRenderConfig(width = 1080, height = 1920, fps = 30): RenderConfig {
  return {
    width,
    height,
    fps,
    format: 'mp4',
    quality: 'medium',
    burnCaptions: true,
    crf: 20,
    audioBitrateKbps: 192,
  };
}

export function emptyProject(projectId: string, title?: string): TimelineProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectId,
    title: title || projectId,
    createdAt: now,
    updatedAt: now,
    scenes: [],
    tracks: defaultTracks(),
    stylePreset: null,
    renderConfig: defaultRenderConfig(),
    metadata: {
      source: 'manual',
      sceneCount: 0,
      derivedFromLegacy: false,
      durationFrames: 0,
    },
  };
}

/**
 * Aplica los filtros del EditPlan al array de escenas: `includedScenes`
 * decide `scene.included`, y `sceneOrder` reordena.
 */
function applyPlanToScenes(scenes: Scene[], plan: EditPlan | null): Scene[] {
  if (!plan) return scenes;
  let next = scenes.map((s) => ({ ...s }));

  if (plan.includedScenes.length > 0) {
    const incl = new Set(plan.includedScenes);
    next = next.map((s) => ({ ...s, included: incl.has(s.sceneNumber) }));
  }

  if (plan.sceneOrder.length > 0) {
    const order = new Map<number, number>(
      plan.sceneOrder.map((n, i) => [n, i])
    );
    next = next
      .slice()
      .sort(
        (a, b) =>
          (order.get(a.sceneNumber) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.sceneNumber) ?? Number.MAX_SAFE_INTEGER)
      );
  }

  return recalcFrames(next);
}

export function fromTimelineDocument(
  doc: TimelineDocument,
  plan: EditPlan | null = null,
  opts: { title?: string } = {}
): TimelineProject {
  const rawScenes = buildScenesFromDoc(doc);
  const scenes = applyPlanToScenes(rawScenes, plan);
  const now = new Date().toISOString();

  return {
    version: 1,
    projectId: doc.projectId,
    title: opts.title || doc.title || doc.projectId,
    createdAt: doc.metadata.createdAt || now,
    updatedAt: now,
    scenes,
    tracks: defaultTracks(),
    stylePreset: getStylePreset(plan?.presetId ?? null),
    renderConfig: {
      ...defaultRenderConfig(doc.width, doc.height, doc.fps),
      burnCaptions: doc.captions.length > 0,
    },
    metadata: {
      source: doc.metadata.source,
      sceneCount: scenes.length,
      derivedFromLegacy: true,
      durationFrames: totalDurationFrames(scenes),
    },
  };
}

/**
 * Reconstruye un TimelineDocument a partir del scene graph.
 *
 * Sólo incluye escenas con `included === true` y un asset `image`/`video`.
 * El resultado es lo que el render legacy (ffmpeg) sabe consumir, por lo
 * que el editor puede mutar libremente el scene graph y, al guardar,
 * regenerar un timeline.json coherente sin tocar el pipeline.
 */
export function toTimelineDocument(project: TimelineProject): TimelineDocument {
  const fps = project.renderConfig.fps;
  const width = project.renderConfig.width;
  const height = project.renderConfig.height;

  const includedScenes = project.scenes.filter((s) => s.included);
  // Recalcular frames sobre el subset incluido para que el legacy reciba
  // tiempos consistentes (de lo contrario quedarían huecos).
  let cursor = 0;
  const recalculated = includedScenes.map((s) => {
    const startFrame = cursor;
    const endFrame = cursor + s.durationFrames;
    cursor = endFrame;
    return { ...s, startFrame, endFrame };
  });

  const clips = recalculated.map((s) => {
    const primary = pickPrimaryAsset(s);
    return {
      id: `clip-${s.sceneNumber}`,
      sceneNumber: s.sceneNumber,
      kind: (primary?.kind === 'video' ? 'video' : 'image') as 'image' | 'video',
      src: primary?.src ?? null,
      startFrame: s.startFrame,
      durationFrames: s.durationFrames,
      transitionIn: s.transition.inKind || 'fade',
      effects: s.effects.map((e) => e.kind),
    };
  });

  const captions = recalculated.flatMap((s) =>
    s.captions.map((c) => ({
      id: `caption-${s.sceneNumber}`,
      text: c.text,
      startFrame: s.startFrame,
      endFrame: s.endFrame,
      words: c.words.map((w) => {
        // Reescalar palabras al nuevo span de la escena.
        const origSpan = Math.max(c.endFrame - c.startFrame, 1);
        const newSpan = s.endFrame - s.startFrame;
        const ratio = newSpan / origSpan;
        const offsetIn = w.startFrame - c.startFrame;
        const offsetOut = w.endFrame - c.startFrame;
        return {
          text: w.text,
          startFrame: Math.round(s.startFrame + offsetIn * ratio),
          endFrame: Math.round(s.startFrame + offsetOut * ratio),
        };
      }),
      style: c.style,
    }))
  );

  return {
    version: 1,
    projectId: project.projectId,
    title: project.title,
    fps,
    width,
    height,
    durationFrames: cursor,
    clips,
    captions,
    audio: null, // los audio tracks ricos no caben en el legacy 1-track audio
    metadata: {
      createdAt: project.metadata.derivedFromLegacy ? project.createdAt : project.updatedAt,
      sceneCount: clips.length,
      source: project.metadata.source === 'derived' ? 'manual' : project.metadata.source,
    },
  };
}

/**
 * Elige el asset principal de una escena: video primero, imagen como fallback.
 * Es la regla simple que el render legacy implementa.
 */
function pickPrimaryAsset(scene: Scene) {
  return (
    scene.assets.find((a) => a.kind === 'video' && a.src) ??
    scene.assets.find((a) => a.kind === 'image' && a.src) ??
    null
  );
}
