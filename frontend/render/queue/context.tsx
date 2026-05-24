'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { streamRenderJob } from './api';
import { StreamCancelledError } from '@/lib/api';
import type { RenderJob, RenderJobInit, RenderStatus } from './types';

interface State {
  jobs: RenderJob[];
}

type Action =
  | { type: 'ENQUEUE'; job: RenderJob }
  | { type: 'PROGRESS'; jobId: string; phase: RenderStatus; message: string; progress: number | null }
  | { type: 'DONE'; jobId: string; url: string; cacheHits: number; durationSeconds: number }
  | { type: 'FAIL'; jobId: string; error: string }
  | { type: 'CANCEL'; jobId: string }
  | { type: 'CLEAR_DONE' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ENQUEUE':
      return { jobs: [...state.jobs, action.job].slice(-20) };
    case 'PROGRESS':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: action.phase, message: action.message, progress: action.progress }
            : j
        ),
      };
    case 'DONE':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                status: 'done',
                progress: 1,
                outputUrl: action.url,
                cacheHits: action.cacheHits,
                durationSeconds: action.durationSeconds,
                finishedAt: new Date().toISOString(),
                message: 'Render completo',
              }
            : j
        ),
      };
    case 'FAIL':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'failed', error: action.error, finishedAt: new Date().toISOString() }
            : j
        ),
      };
    case 'CANCEL':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'cancelled', finishedAt: new Date().toISOString() }
            : j
        ),
      };
    case 'CLEAR_DONE':
      return {
        jobs: state.jobs.filter((j) => j.status !== 'done' && j.status !== 'failed' && j.status !== 'cancelled'),
      };
    default:
      return state;
  }
}

interface CtxValue {
  state: State;
  enqueue: (init: RenderJobInit) => string;
  cancel: (jobId: string) => void;
  clearDone: () => void;
}

const Ctx = createContext<CtxValue | null>(null);

/**
 * Provider del Render Queue del frontend. Maneja N jobs concurrentes
 * (cada uno con su AbortController). El render real corre en el backend.
 */
export function RenderQueueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { jobs: [] });
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  const enqueue = useCallback(
    (init: RenderJobInit): string => {
      const id = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const job: RenderJob = {
        id,
        projectId: init.projectId,
        presetId: init.presetId ?? null,
        burnCaptions: init.burnCaptions !== false,
        force: init.force === true,
        status: 'connecting',
        progress: null,
        message: 'Conectando…',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ENQUEUE', job });

      const ctrl = new AbortController();
      abortRefs.current.set(id, ctrl);

      void (async () => {
        try {
          const outcome = await streamRenderJob(
            init,
            {
              onTick: ({ phase, message, progress }) =>
                dispatch({ type: 'PROGRESS', jobId: id, phase, message, progress }),
            },
            ctrl.signal
          );
          abortRefs.current.delete(id);
          if (outcome.status === 'done') {
            dispatch({
              type: 'DONE',
              jobId: id,
              url: outcome.render.url,
              cacheHits: outcome.render.cacheHits,
              durationSeconds: outcome.render.durationSeconds,
            });
          } else if (outcome.status === 'cancelled') {
            dispatch({ type: 'CANCEL', jobId: id });
          } else {
            dispatch({ type: 'FAIL', jobId: id, error: outcome.error });
          }
        } catch (err) {
          abortRefs.current.delete(id);
          if (err instanceof StreamCancelledError) {
            dispatch({ type: 'CANCEL', jobId: id });
          } else {
            dispatch({
              type: 'FAIL',
              jobId: id,
              error: err instanceof Error ? err.message : 'Error desconocido',
            });
          }
        }
      })();

      return id;
    },
    []
  );

  const cancel = useCallback((jobId: string) => {
    const ctrl = abortRefs.current.get(jobId);
    if (ctrl) ctrl.abort();
  }, []);

  const clearDone = useCallback(() => dispatch({ type: 'CLEAR_DONE' }), []);

  const value = useMemo<CtxValue>(() => ({ state, enqueue, cancel, clearDone }), [
    state,
    enqueue,
    cancel,
    clearDone,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRenderQueue(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRenderQueue debe usarse dentro de <RenderQueueProvider>.');
  return v;
}
