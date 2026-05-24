/** Barrel de tipos del scene graph — importa desde aquí en el resto del editor. */
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
} from './scene';
export type { Track, TrackKind } from './tracks';
export { defaultTracks } from './tracks';
export type {
  TimelineProject,
  EditingProject,
  StylePreset,
  RenderConfig,
} from './project';
