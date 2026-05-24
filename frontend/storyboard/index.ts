/**
 * Tim Koda — Storyboard Engine.
 *
 * Centro principal de edición IA: grid de escenas + drag & drop + prompt
 * por escena + versionado + sidebar de materiales. Vive sobre el scene graph
 * (`@/editing`) y se persiste vía `/api/editing-project`.
 *
 *   <StoryboardProvider initialProject={…}>
 *     <StoryboardPanel />
 *   </StoryboardProvider>
 */

// Components
export * from './components';

// Store
export {
  StoryboardProvider,
  useStoryboard,
  useStoryboardState,
  useStoryboardDispatch,
  useSelectedScene,
  useHistory,
} from './store/context';
export { reducer, initialState, type StoryboardState } from './store/reducer';
export type { StoryboardAction } from './store/actions';
export {
  selectScene,
  moveScene,
  updateScene,
  setScenePrompt,
  pushVersion,
  revertVersion,
  setSidebarTab,
} from './store/actions';

// Hooks
export { useStoryboardProject } from './hooks/useStoryboardProject';
export { useAutoSave } from './hooks/useAutoSave';
export { useSceneDrag } from './hooks/useSceneDrag';

// Types
export type {
  SidebarTab,
  SidebarTabMeta,
  DragState,
  SaveState,
  SceneStatusUi,
} from './types/ui';
export { SIDEBAR_TABS } from './types/ui';

// Utils
export { pickThumbnail } from './utils/thumbnails';
export { sceneStatusUi, statusLabel, statusColor } from './utils/status';
export { QUICK_PROMPTS, applyQuickPrompt } from './utils/prompts';
