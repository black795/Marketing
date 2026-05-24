/**
 * Hook para conectar HTML5 D&D a una card de escena dentro del grid.
 *
 * Devuelve los handlers listos para spread en el elemento:
 *
 *   const { handlers, isDragging, isOver } = useSceneDrag(sceneId, index);
 *   <div draggable {...handlers}>…</div>
 */
import { useCallback } from 'react';
import { useStoryboard } from '../store/context';
import { readSceneId, writeSceneId } from '../utils/dnd';

export function useSceneDrag(sceneId: string, index: number) {
  const { state, dispatch } = useStoryboard();
  const isDragging = state.drag.draggingSceneId === sceneId;
  const isOver = state.drag.overIndex === index && state.drag.draggingSceneId !== null;

  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      writeSceneId(e.dataTransfer, sceneId);
      dispatch({ type: 'SET_DRAGGING', sceneId });
    },
    [sceneId, dispatch]
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      dispatch({ type: 'SET_DRAG_OVER', index });
    },
    [index, dispatch]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Necesario para que `drop` se dispare.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      // Sólo limpiamos si salimos del card (no si entramos en un hijo).
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (state.drag.overIndex === index) {
        dispatch({ type: 'SET_DRAG_OVER', index: -1 });
      }
    },
    [index, state.drag.overIndex, dispatch]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const droppedSceneId = readSceneId(e.dataTransfer);
      dispatch({ type: 'SET_DRAGGING', sceneId: null });
      dispatch({ type: 'SET_DRAG_OVER', index: -1 });
      if (!droppedSceneId || droppedSceneId === sceneId) return;
      dispatch({ type: 'MOVE_SCENE', sceneId: droppedSceneId, toIndex: index });
    },
    [sceneId, index, dispatch]
  );

  const onDragEnd = useCallback(() => {
    dispatch({ type: 'SET_DRAGGING', sceneId: null });
    dispatch({ type: 'SET_DRAG_OVER', index: -1 });
  }, [dispatch]);

  return {
    isDragging,
    isOver,
    handlers: {
      draggable: true as const,
      onDragStart,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd,
    },
  };
}
