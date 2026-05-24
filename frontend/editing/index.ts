/**
 * Tim Koda — Editing Architecture (Scene Graph + TimelineProject).
 *
 * Capa de edición profesional construida ENCIMA del timeline.json legacy.
 * Coexiste con el pipeline actual de render: cuando se guarda el proyecto,
 * se persiste el scene graph rico (editing-project.json) Y se regenera el
 * timeline.json equivalente — de modo que el render con ffmpeg sigue
 * funcionando exactamente igual.
 *
 *   import { fromTimelineDocument, moveScene, classifyScene, ... } from '@/editing';
 *
 * Estructura del paquete:
 *
 *   types/    → contratos (Scene, TimelineProject, RenderConfig, …)
 *   utils/    → helpers puros (ids, time, narrative)
 *   scenes/   → builder automático + clasificador narrativo + versions
 *   core/     → operaciones sobre el graph + conversiones con el legacy
 */

// Types
export type {
  Scene,
  SceneRole,
  SceneEmotion,
  RenderState,
  SceneAsset,
  SceneOverlay,
  SceneCaption,
  SceneWord,
  SceneAudioTrack,
  SceneTransition,
  SceneEffect,
  SceneCamera,
  SceneVersion,
  Track,
  TrackKind,
  TimelineProject,
  EditingProject,
  StylePreset,
  RenderConfig,
} from './types';
export { defaultTracks } from './types';

// Utils
export {
  secondsToFrames,
  framesToSeconds,
  framesToMmSs,
  sumDurationFrames,
} from './utils/time';
export {
  newSceneId,
  newAssetId,
  newOverlayId,
  newCaptionId,
  newAudioTrackId,
  newEffectId,
  newVersionId,
} from './utils/ids';
export { detectNarrativeRole } from './utils/narrative';

// Scenes
export { classifyScene } from './scenes/classifier';
export { fromTimelineDocument as buildScenesFromTimeline, fromStoryScenes } from './scenes/builder';
export { pushVersion, revertToVersion, latestVersion } from './scenes/versions';
export { splitScene } from './scenes/split';

// Core
export * from './core';
