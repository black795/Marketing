/**
 * Hook de zoom — soporta wheel (ctrl/cmd) + botones +/- + niveles preset.
 */
import { useCallback } from 'react';
import { ZOOM_LEVELS } from '../utils/pixels';
import { useTimelineUi } from '../store/context';

export function useZoom() {
  const { ui, dispatchUi } = useTimelineUi();

  const setZoom = useCallback(
    (pxPerFrame: number) => {
      const clamped = Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], pxPerFrame));
      dispatchUi({ type: 'SET_ZOOM', pxPerFrame: clamped });
    },
    [dispatchUi]
  );

  const zoomIn = useCallback(() => {
    const idx = ZOOM_LEVELS.findIndex((l) => l > ui.pxPerFrame);
    if (idx >= 0) setZoom(ZOOM_LEVELS[idx]);
  }, [ui.pxPerFrame, setZoom]);

  const zoomOut = useCallback(() => {
    const idx = [...ZOOM_LEVELS].reverse().findIndex((l) => l < ui.pxPerFrame);
    if (idx >= 0) setZoom([...ZOOM_LEVELS].reverse()[idx]);
  }, [ui.pxPerFrame, setZoom]);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    },
    [zoomIn, zoomOut]
  );

  return { pxPerFrame: ui.pxPerFrame, setZoom, zoomIn, zoomOut, onWheel };
}
