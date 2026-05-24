/**
 * Action creators del store del storyboard.
 *
 * Discriminated union: cada action lleva `type` + payload tipado. El reducer
 * pattern-matchea por `type`. Las mutaciones complejas (mover escena, push
 * de versión) viven en `editing/core`/`editing/scenes`; aquí sólo son acciones.
 */
import type { Scene, SceneVersion, TimelineProject, RenderState } from '@/editing';
import type { SidebarTab } from '../types/ui';

export type StoryboardAction =
  | { type: 'INIT'; project: TimelineProject }
  | { type: 'APPLY_PROJECT'; project: TimelineProject }
  | { type: 'SELECT_SCENE'; sceneId: string | null }
  | { type: 'MOVE_SCENE'; sceneId: string; toIndex: number }
  | { type: 'UPDATE_SCENE'; sceneId: string; patch: Partial<Scene> }
  | { type: 'TOGGLE_INCLUDED'; sceneId: string }
  | { type: 'DUPLICATE_SCENE'; sceneId: string }
  | { type: 'REMOVE_SCENE'; sceneId: string }
  | { type: 'SPLIT_SCENE'; sceneId: string; atFrameAbsolute: number }
  | { type: 'RIPPLE_DELETE'; sceneIds: string[] }
  | { type: 'SET_SCENE_PROMPT'; sceneId: string; prompt: string }
  | { type: 'SET_SCENE_STATUS'; sceneId: string; status: RenderState }
  | { type: 'PUSH_VERSION'; sceneId: string; reason: string; label?: string }
  | { type: 'REVERT_VERSION'; sceneId: string; versionId: string }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_SIDEBAR_TAB'; tab: SidebarTab }
  | { type: 'SET_DRAG_OVER'; index: number }
  | { type: 'SET_DRAGGING'; sceneId: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_SAVING' }
  | { type: 'MARK_ERROR'; error: string };

/* Atajos sintácticos para emisores frecuentes — útiles desde componentes. */

export const selectScene = (sceneId: string | null): StoryboardAction => ({
  type: 'SELECT_SCENE',
  sceneId,
});

export const moveScene = (sceneId: string, toIndex: number): StoryboardAction => ({
  type: 'MOVE_SCENE',
  sceneId,
  toIndex,
});

export const updateScene = (sceneId: string, patch: Partial<Scene>): StoryboardAction => ({
  type: 'UPDATE_SCENE',
  sceneId,
  patch,
});

export const setScenePrompt = (sceneId: string, prompt: string): StoryboardAction => ({
  type: 'SET_SCENE_PROMPT',
  sceneId,
  prompt,
});

export const pushVersion = (
  sceneId: string,
  reason: string,
  label?: string
): StoryboardAction => ({ type: 'PUSH_VERSION', sceneId, reason, label });

export const revertVersion = (sceneId: string, versionId: string): StoryboardAction => ({
  type: 'REVERT_VERSION',
  sceneId,
  versionId,
});

export const setSidebarTab = (tab: SidebarTab): StoryboardAction => ({
  type: 'SET_SIDEBAR_TAB',
  tab,
});
