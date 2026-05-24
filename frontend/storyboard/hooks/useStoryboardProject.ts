/**
 * Carga inicial de un proyecto del storyboard.
 *
 * Lógica de fallback en cascada:
 *   1. `GET /api/editing-project/:projectId` — si existe, lo usa tal cual.
 *   2. Si no existe, deriva uno desde `timeline.json` + `edit-plan.json`
 *      del backend (vía las APIs ya existentes) usando `fromTimelineDocument`.
 *   3. Si tampoco hay timeline, devuelve null (la UI muestra empty state).
 *
 * No persiste — sólo carga. El autosave del store lo guarda en cuanto haya
 * la primera mutación.
 */
import { useEffect, useState } from 'react';
import { loadTimeline } from '@/lib/captions-api';
import { getEditPlan } from '@/lib/edit-plan-api';
import { loadEditingProject } from '@/lib/editing-project-api';
import { fromTimelineDocument, type TimelineProject } from '@/editing';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface StoryboardLoadResult {
  status: LoadStatus;
  project: TimelineProject | null;
  error: string | null;
  /** true si el proyecto fue derivado del legacy (aún no persiste su .json). */
  derived: boolean;
}

export function useStoryboardProject(projectId: string | null): StoryboardLoadResult {
  const [result, setResult] = useState<StoryboardLoadResult>({
    status: 'idle',
    project: null,
    error: null,
    derived: false,
  });

  useEffect(() => {
    if (!projectId) {
      setResult({ status: 'empty', project: null, error: null, derived: false });
      return;
    }

    let cancelled = false;
    setResult((r) => ({ ...r, status: 'loading', error: null }));

    (async () => {
      try {
        // 1. ¿Existe ya el editing-project.json?
        const persisted = await loadEditingProject(projectId);
        if (cancelled) return;
        if (persisted) {
          setResult({
            status: 'ready',
            project: persisted,
            error: null,
            derived: false,
          });
          return;
        }

        // 2. Derivar de timeline.json + edit-plan.
        const [tl, planResult] = await Promise.all([
          loadTimeline(projectId),
          getEditPlan(projectId).catch(() => ({ plan: null })),
        ]);
        if (cancelled) return;
        if (!tl) {
          setResult({
            status: 'empty',
            project: null,
            error: null,
            derived: false,
          });
          return;
        }
        const project = fromTimelineDocument(tl, planResult.plan ?? null);
        setResult({
          status: 'ready',
          project,
          error: null,
          derived: true,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          status: 'error',
          project: null,
          error: err instanceof Error ? err.message : 'Error desconocido',
          derived: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return result;
}
