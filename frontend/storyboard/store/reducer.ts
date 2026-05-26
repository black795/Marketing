/**
 * Reducer puro del storyboard.
 *
 * Mantiene `TimelineProject` (dominio) + estado UI (selección, sidebar, drag).
 * Cada mutación que toca el proyecto:
 *   1. Empuja el snapshot previo a `history.past` (cap 30).
 *   2. Limpia `history.future` salvo en UNDO/REDO.
 *   3. Recalcula frames cuando aplica.
 *   4. Marca `saveState = 'dirty'` para que el autosave lo recoja.
 *
 * Las mutaciones del proyecto delegan en helpers de `editing/core` —
 * el reducer no duplica esa lógica.
 */
import type { TimelineProject, Scene, RenderState } from '@/editing';
import {
  moveScene as gMove,
  updateScene as gUpdate,
  toggleIncluded as gToggle,
  duplicateScene as gDuplicate,
  removeScene as gRemove,
  splitScene as gSplit,
  totalDurationFrames,
  recalcFrames,
  newSceneId,
} from '@/editing';
import { pushVersion as pushSceneVersion, revertToVersion } from '@/editing';
import { bumpToStaleIfRendered } from '../utils/status';
import type { SidebarTab, DragState, SaveState } from '../types/ui';
import type { StoryboardAction } from './actions';

const HISTORY_CAP = 30;

export interface StoryboardState {
  project: TimelineProject;
  selectedSceneId: string | null;
  sidebarTab: SidebarTab;
  drag: DragState;
  saveState: SaveState;
  saveError: string | null;
  history: { past: TimelineProject[]; future: TimelineProject[] };
}

export function initialState(project: TimelineProject): StoryboardState {
  // Defensa: si llega un proyecto sin scenes (json legacy o corrupto), tratamos
  // como array vacío para no crashear el árbol. El loader debería filtrar esto
  // antes, pero la red puede traer cualquier shape.
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const safeProject = scenes === project.scenes ? project : { ...project, scenes };
  return {
    project: safeProject,
    selectedSceneId: scenes[0]?.id ?? null,
    sidebarTab: 'images',
    drag: { draggingSceneId: null, overIndex: -1 },
    saveState: 'idle',
    saveError: null,
    history: { past: [], future: [] },
  };
}

function withUpdatedMetadata(project: TimelineProject, scenes: Scene[]): TimelineProject {
  return {
    ...project,
    scenes,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...project.metadata,
      sceneCount: scenes.length,
      durationFrames: totalDurationFrames(scenes),
    },
  };
}

/** Aplica una mutación al proyecto + actualiza historial + marca dirty. */
function mutateProject(
  state: StoryboardState,
  produce: (p: TimelineProject) => TimelineProject
): StoryboardState {
  const next = produce(state.project);
  if (next === state.project) return state;
  return {
    ...state,
    project: next,
    history: {
      past: [...state.history.past, state.project].slice(-HISTORY_CAP),
      future: [], // cualquier edición nueva tira el futuro de redo
    },
    saveState: 'dirty',
    saveError: null,
  };
}

export function reducer(state: StoryboardState, action: StoryboardAction): StoryboardState {
  switch (action.type) {
    case 'INIT': {
      return initialState(action.project);
    }

    case 'APPLY_PROJECT': {
      // Sustituye el proyecto en bloque preservando historial + marcando dirty.
      // Lo usa el Auto Editing Engine cuando reescribe muchas escenas a la vez.
      return mutateProject(state, () => action.project);
    }

    case 'SELECT_SCENE': {
      if (state.selectedSceneId === action.sceneId) return state;
      return { ...state, selectedSceneId: action.sceneId };
    }

    case 'SET_SIDEBAR_TAB': {
      if (state.sidebarTab === action.tab) return state;
      return { ...state, sidebarTab: action.tab };
    }

    case 'SET_DRAGGING': {
      return {
        ...state,
        drag: { ...state.drag, draggingSceneId: action.sceneId },
      };
    }

    case 'SET_DRAG_OVER': {
      if (state.drag.overIndex === action.index) return state;
      return { ...state, drag: { ...state.drag, overIndex: action.index } };
    }

    case 'MOVE_SCENE': {
      return mutateProject(state, (p) => {
        const scenes = gMove(p.scenes, action.sceneId, action.toIndex);
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'UPDATE_SCENE': {
      return mutateProject(state, (p) => {
        // Si la escena ya estaba renderizada y se modifica, marcamos 'stale'.
        const scene = p.scenes.find((s) => s.id === action.sceneId);
        const patch: Partial<Scene> = { ...action.patch };
        if (scene && !('renderState' in patch)) {
          const stale = bumpToStaleIfRendered(scene.renderState);
          if (stale !== scene.renderState) patch.renderState = stale;
        }
        const scenes = gUpdate(p.scenes, action.sceneId, patch);
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'TOGGLE_INCLUDED': {
      return mutateProject(state, (p) => {
        const scenes = gToggle(p.scenes, action.sceneId);
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'DUPLICATE_SCENE': {
      return mutateProject(state, (p) => {
        const scenes = gDuplicate(p.scenes, action.sceneId, () => newSceneId());
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'REMOVE_SCENE': {
      return mutateProject(state, (p) => {
        const scenes = gRemove(p.scenes, action.sceneId);
        const next = withUpdatedMetadata(p, scenes);
        // Si quitamos la seleccionada, el componente que lee el state debe
        // re-seleccionar — aquí preferimos no tocar state.selectedSceneId
        // para no acoplar dos mutaciones distintas en una sola acción.
        return next;
      });
    }

    case 'SPLIT_SCENE': {
      return mutateProject(state, (p) => {
        const scenes = recalcFrames(
          gSplit(p.scenes, action.sceneId, action.atFrameAbsolute, () =>
            newSceneId()
          )
        );
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'RIPPLE_DELETE': {
      return mutateProject(state, (p) => {
        const toRemove = new Set(action.sceneIds);
        const scenes = recalcFrames(p.scenes.filter((s) => !toRemove.has(s.id)));
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'SET_SCENE_PROMPT': {
      return mutateProject(state, (p) => {
        const scenes = gUpdate(p.scenes, action.sceneId, {
          prompt: action.prompt,
        });
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'SET_SCENE_STATUS': {
      return mutateProject(state, (p) => {
        const scenes = gUpdate(p.scenes, action.sceneId, {
          renderState: action.status as RenderState,
        });
        return withUpdatedMetadata(p, scenes);
      });
    }

    case 'PUSH_VERSION': {
      return mutateProject(state, (p) => {
        const scenes = p.scenes.map((s) =>
          s.id === action.sceneId ? pushSceneVersion(s, action.reason, action.label) : s
        );
        return withUpdatedMetadata(p, recalcFrames(scenes));
      });
    }

    case 'REVERT_VERSION': {
      return mutateProject(state, (p) => {
        const scenes = p.scenes.map((s) =>
          s.id === action.sceneId ? revertToVersion(s, action.versionId) : s
        );
        return withUpdatedMetadata(p, recalcFrames(scenes));
      });
    }

    case 'SET_TITLE': {
      return mutateProject(state, (p) =>
        p.title === action.title ? p : { ...p, title: action.title, updatedAt: new Date().toISOString() }
      );
    }

    case 'UNDO': {
      const prev = state.history.past[state.history.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        project: prev,
        history: {
          past: state.history.past.slice(0, -1),
          future: [state.project, ...state.history.future].slice(0, HISTORY_CAP),
        },
        saveState: 'dirty',
      };
    }

    case 'REDO': {
      const [next, ...rest] = state.history.future;
      if (!next) return state;
      return {
        ...state,
        project: next,
        history: {
          past: [...state.history.past, state.project].slice(-HISTORY_CAP),
          future: rest,
        },
        saveState: 'dirty',
      };
    }

    case 'MARK_SAVING':
      return { ...state, saveState: 'saving', saveError: null };
    case 'MARK_SAVED':
      return { ...state, saveState: 'saved', saveError: null };
    case 'MARK_ERROR':
      return { ...state, saveState: 'error', saveError: action.error };

    default:
      return state;
  }
}
