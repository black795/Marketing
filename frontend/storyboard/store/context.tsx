'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { TimelineProject } from '@/editing';
import { reducer, initialState, type StoryboardState } from './reducer';
import type { StoryboardAction } from './actions';

interface ContextValue {
  state: StoryboardState;
  dispatch: Dispatch<StoryboardAction>;
}

const Ctx = createContext<ContextValue | null>(null);

export function StoryboardProvider({
  initialProject,
  children,
}: {
  initialProject: TimelineProject;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialProject, initialState);
  const value = useMemo<ContextValue>(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook genérico — devuelve estado + dispatch. */
export function useStoryboard(): ContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useStoryboard debe usarse dentro de <StoryboardProvider>.');
  }
  return v;
}

/** Sólo state — lectura. */
export function useStoryboardState(): StoryboardState {
  return useStoryboard().state;
}

/** Sólo dispatch — escritura. */
export function useStoryboardDispatch(): Dispatch<StoryboardAction> {
  return useStoryboard().dispatch;
}

/** Devuelve la escena seleccionada o null. */
export function useSelectedScene() {
  const { state } = useStoryboard();
  return useMemo(() => {
    if (!state.selectedSceneId) return null;
    return (
      state.project.scenes.find((s) => s.id === state.selectedSceneId) ?? null
    );
  }, [state.selectedSceneId, state.project.scenes]);
}

/** Atajos de undo/redo + flags de disponibilidad. */
export function useHistory() {
  const { state, dispatch } = useStoryboard();
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);
  return {
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    undo,
    redo,
  };
}
