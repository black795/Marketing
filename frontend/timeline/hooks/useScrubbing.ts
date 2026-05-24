/**
 * Drag del playhead (sobre el ruler o sobre el área de tracks).
 *
 * Convierte la posición clientX → frame considerando scrollLeft y pxPerFrame
 * del ref del canvas pasado por el caller. Mientras dura el drag escucha
 * mousemove/mouseup en window, no sólo en el elemento.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimelineUi } from '../store/context';
import { pxToFrames } from '../utils/pixels';

export function useScrubbing(canvasRef: React.RefObject<HTMLElement>) {
  const { ui, dispatchUi } = useTimelineUi();
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const setFrameFromClientX = useCallback(
    (clientX: number) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left + el.scrollLeft;
      const frame = Math.max(0, pxToFrames(px, ui.pxPerFrame));
      dispatchUi({ type: 'SET_PLAYHEAD', frame });
    },
    [canvasRef, ui.pxPerFrame, dispatchUi]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      draggingRef.current = true;
      setDragging(true);
      setFrameFromClientX(e.clientX);
    },
    [setFrameFromClientX]
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      setFrameFromClientX(e.clientX);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setFrameFromClientX]);

  return { onMouseDown, dragging };
}
