/** Barrel de la capa core — operaciones sobre el scene graph + conversiones. */
export {
  recalcFrames,
  findSceneById,
  findSceneByNumber,
  updateScene,
  moveScene,
  insertScene,
  removeScene,
  duplicateScene,
  toggleIncluded,
  totalDurationFrames,
  isProjectRenderable,
} from './scene-graph';

export {
  emptyProject,
  fromTimelineDocument,
  toTimelineDocument,
} from './timeline-project';

export { STYLE_PRESETS, getStylePreset } from './style-presets';
