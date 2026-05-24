/**
 * Autosave del proyecto del storyboard.
 *
 * Cuando `state.saveState === 'dirty'`, espera `DEBOUNCE_MS` y persiste:
 *   1. El scene graph completo en `editing-project.json` (PUT /api/editing-project).
 *   2. Un `timeline.json` derivado vía `toTimelineDocument` — para que el
 *      render con ffmpeg siga funcionando sobre el formato que ya entiende.
 *
 * Marca el state con MARK_SAVING/SAVED/ERROR para que la UI muestre feedback.
 */
import { useEffect, useRef } from 'react';
import { saveEditingProject } from '@/lib/editing-project-api';
import { buildTimeline } from '@/lib/captions-api';
import { toTimelineDocument, type TimelineProject } from '@/editing';
import { useStoryboard } from '../store/context';

const DEBOUNCE_MS = 1200;

export function useAutoSave(): void {
  const { state, dispatch } = useStoryboard();
  const projectRef = useRef<TimelineProject>(state.project);
  projectRef.current = state.project;

  useEffect(() => {
    if (state.saveState !== 'dirty') return;
    const handle = window.setTimeout(async () => {
      const snapshot = projectRef.current;
      dispatch({ type: 'MARK_SAVING' });
      try {
        // 1. Scene graph (fuente rica de verdad).
        await saveEditingProject(snapshot);

        // 2. Timeline legacy (lo que consume el render).
        const legacy = toTimelineDocument(snapshot);
        // `buildTimeline` espera escenas crudas — se las pasamos derivadas
        // de los clips del documento legacy para que la persistencia del
        // timeline.json en el backend quede coherente.
        await buildTimeline({
          projectId: snapshot.projectId,
          title: snapshot.title,
          fps: legacy.fps,
          width: legacy.width,
          height: legacy.height,
          source: legacy.metadata.source,
          audioUrl: legacy.audio?.src ?? null,
          respectOrder: true,
          scenes: legacy.clips.map((c) => ({
            scene_number: c.sceneNumber,
            image_url: c.kind === 'image' ? c.src : null,
            video_url: c.kind === 'video' ? c.src : null,
            local_url: c.kind === 'video' ? c.src : null,
            duration: c.durationFrames / legacy.fps,
            narration:
              legacy.captions.find((cap) => cap.startFrame === c.startFrame)?.text ?? undefined,
          })),
        });

        dispatch({ type: 'MARK_SAVED' });
      } catch (err) {
        dispatch({
          type: 'MARK_ERROR',
          error: err instanceof Error ? err.message : 'Error guardando',
        });
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [state.saveState, dispatch]);
}
