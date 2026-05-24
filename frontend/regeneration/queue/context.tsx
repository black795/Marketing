'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { initialQueueState, queueReducer, type QueueState } from './reducer';
import type { QueueAction } from './actions';
import { useStoryboard } from '@/storyboard';
import { REGENERATORS } from '../regenerators';
import { recalcFrames, totalDurationFrames } from '@/editing';

interface CtxValue {
  state: QueueState;
  dispatch: Dispatch<QueueAction>;
}

const Ctx = createContext<CtxValue | null>(null);

/**
 * Provider del Regen Queue + runner integrado.
 *
 * Cada vez que aparece un job 'queued' al inicio del array, el effect lo
 * mueve a 'running', ejecuta el regenerator correspondiente, aplica el
 * patch al store del Storyboard (APPLY_PROJECT preserva history), y lo
 * marca 'done'. Si falla, lo marca 'failed' con el mensaje.
 *
 * El runner es secuencial — un job a la vez — para evitar conflictos al
 * tocar la misma escena. Puede paralelizarse por sceneId distinto en
 * futuras iteraciones (group by scene + N workers).
 */
export function RegenQueueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);
  const { state: sb, dispatch: dispatchSb } = useStoryboard();
  const value = useMemo(() => ({ state, dispatch }), [state]);

  useEffect(() => {
    const next = state.jobs.find((j) => j.status === 'queued');
    if (!next) return;

    let cancelled = false;
    dispatch({ type: 'START', jobId: next.id });

    (async () => {
      try {
        // El runner es síncrono salvo I/O futuro. Pequeño tick para que la
        // UI muestre el estado 'running' antes de bloquear.
        await new Promise((r) => setTimeout(r, 30));
        if (cancelled) return;

        const scene = sb.project.scenes.find((s) => s.id === next.sceneId);
        if (!scene) throw new Error('Escena no encontrada (puede haberse eliminado).');

        const regen = REGENERATORS[next.target];
        const patch = regen(scene, sb.project, { options: next.options });
        if (Object.keys(patch).length === 0) {
          dispatch({ type: 'COMPLETE', jobId: next.id, message: 'Sin cambios.' });
          return;
        }

        const newScenes = sb.project.scenes.map((s) =>
          s.id === next.sceneId ? { ...s, ...patch, renderState: 'stale' as const } : s
        );
        const reflowed = recalcFrames(newScenes);
        dispatchSb({
          type: 'APPLY_PROJECT',
          project: {
            ...sb.project,
            scenes: reflowed,
            metadata: {
              ...sb.project.metadata,
              durationFrames: totalDurationFrames(reflowed),
            },
            updatedAt: new Date().toISOString(),
          },
        });

        const targetKeys = Object.keys(patch).join(', ');
        dispatch({
          type: 'COMPLETE',
          jobId: next.id,
          message: `Actualizado: ${targetKeys}`,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        dispatch({ type: 'FAIL', jobId: next.id, error: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Sólo reacciona a la lista de jobs — no a cada cambio del proyecto, para
    // evitar disparar el runner en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobs, dispatchSb]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRegenQueue(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRegenQueue debe usarse dentro de <RegenQueueProvider>.');
  return v;
}
