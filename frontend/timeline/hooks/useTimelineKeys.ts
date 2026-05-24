/**
 * Atajos de teclado del timeline.
 *
 *   V/T/S/H      → cambiar herramienta
 *   Delete       → ripple-delete de la selección
 *   Ctrl+D       → duplicate
 *   Ctrl+K       → split en el playhead (de la primera escena seleccionada)
 *   ←/→          → mover playhead ±1 frame
 *   Shift+←/→    → mover playhead ±10 frames
 *   Space        → toggle del playhead (no implementa playback aún)
 */
import { useEffect } from 'react';
import { useStoryboard } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import type { TimelineTool } from '../types';

const TOOL_KEY: Record<string, TimelineTool> = {
  v: 'select',
  t: 'trim',
  s: 'split',
  h: 'hand',
};

export function useTimelineKeys() {
  const { state: sb, dispatch: dispatchSb } = useStoryboard();
  const { ui, dispatchUi } = useTimelineUi();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      const key = e.key.toLowerCase();
      const tool = TOOL_KEY[key];
      if (tool) {
        e.preventDefault();
        dispatchUi({ type: 'SET_TOOL', tool });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ui.selection.length > 0) {
          e.preventDefault();
          dispatchSb({ type: 'RIPPLE_DELETE', sceneIds: ui.selection });
          dispatchUi({ type: 'CLEAR_SELECTION' });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'd') {
        if (ui.selection.length === 1) {
          e.preventDefault();
          dispatchSb({ type: 'DUPLICATE_SCENE', sceneId: ui.selection[0] });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        if (ui.selection.length > 0) {
          e.preventDefault();
          dispatchSb({
            type: 'SPLIT_SCENE',
            sceneId: ui.selection[0],
            atFrameAbsolute: ui.playheadFrame,
          });
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const delta = e.shiftKey ? 10 : 1;
        e.preventDefault();
        dispatchUi({
          type: 'SET_PLAYHEAD',
          frame: ui.playheadFrame + (e.key === 'ArrowRight' ? delta : -delta),
        });
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.selection, ui.playheadFrame, dispatchSb, dispatchUi, sb.project.scenes]);
}
