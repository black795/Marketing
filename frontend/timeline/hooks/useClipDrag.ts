/**
 * Drag de un clip — soporta tres modos:
 *
 *   - move      (mover toda la escena dentro del orden — al soltar, dispatch MOVE_SCENE)
 *   - trim-left (mover el borde izquierdo)
 *   - trim-right(mover el borde derecho — cambia durationFrames)
 *
 * Aplica snap si está habilitado. Mantiene el state en el closure local y
 * sólo dispatcha el cambio al soltar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scene } from '@/editing';
import { useStoryboard } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import { findSnap } from '../utils/snap';
import { pxToFrames } from '../utils/pixels';

type Mode = 'move' | 'trim-left' | 'trim-right';

interface DragState {
  mode: Mode;
  startClientX: number;
  startScene: Scene;
  /** Snapshot del proyecto al iniciar. */
  scenes: Scene[];
  fps: number;
}

interface DragLive {
  deltaPx: number;
  newDuration: number;
  newStartFrame: number;
  snapped: boolean;
}

export function useClipDrag() {
  const { state: sb, dispatch: dispatchSb } = useStoryboard();
  const { ui } = useTimelineUi();
  const dragRef = useRef<DragState | null>(null);
  const [live, setLive] = useState<DragLive | null>(null);

  const begin = useCallback(
    (mode: Mode, scene: Scene, clientX: number) => {
      dragRef.current = {
        mode,
        startClientX: clientX,
        startScene: scene,
        scenes: sb.project.scenes,
        fps: sb.project.renderConfig.fps,
      };
      setLive({
        deltaPx: 0,
        newDuration: scene.durationFrames,
        newStartFrame: scene.startFrame,
        snapped: false,
      });
    },
    [sb.project]
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startClientX;
      const deltaFrames = pxToFrames(dx, ui.pxPerFrame);

      let newStart = d.startScene.startFrame;
      let newDuration = d.startScene.durationFrames;
      let snapped = false;

      if (d.mode === 'trim-right') {
        const rawEnd = d.startScene.endFrame + deltaFrames;
        const target = ui.snapEnabled
          ? findSnap({
              frame: rawEnd,
              scenes: d.scenes,
              playheadFrame: ui.playheadFrame,
              fps: d.fps,
              excludeSceneId: d.startScene.id,
            })
          : { frame: rawEnd, snapped: false, source: 'none' as const };
        snapped = target.snapped;
        newDuration = Math.max(6, target.frame - d.startScene.startFrame);
      } else if (d.mode === 'trim-left') {
        const rawStart = d.startScene.startFrame + deltaFrames;
        const target = ui.snapEnabled
          ? findSnap({
              frame: rawStart,
              scenes: d.scenes,
              playheadFrame: ui.playheadFrame,
              fps: d.fps,
              excludeSceneId: d.startScene.id,
            })
          : { frame: rawStart, snapped: false, source: 'none' as const };
        snapped = target.snapped;
        const clampedStart = Math.min(
          target.frame,
          d.startScene.endFrame - 6
        );
        newDuration = d.startScene.endFrame - clampedStart;
        newStart = clampedStart;
      } else {
        // move: solo registramos el delta — el reorden real lo computamos al soltar.
        newStart = d.startScene.startFrame + deltaFrames;
      }

      setLive({
        deltaPx: dx,
        newDuration,
        newStartFrame: newStart,
        snapped,
      });
    }

    function onUp() {
      const d = dragRef.current;
      const l = live;
      dragRef.current = null;
      setLive(null);
      if (!d || !l) return;

      if (d.mode === 'trim-right' || d.mode === 'trim-left') {
        if (l.newDuration !== d.startScene.durationFrames) {
          dispatchSb({
            type: 'UPDATE_SCENE',
            sceneId: d.startScene.id,
            patch: { durationFrames: l.newDuration },
          });
        }
      } else if (d.mode === 'move') {
        // Calcular el nuevo índice según el delta frame.
        const newCenterFrame = l.newStartFrame + d.startScene.durationFrames / 2;
        let toIndex = d.scenes.findIndex(
          (s) => s.startFrame + s.durationFrames / 2 >= newCenterFrame
        );
        if (toIndex === -1) toIndex = d.scenes.length - 1;
        const currentIndex = d.scenes.findIndex((s) => s.id === d.startScene.id);
        if (toIndex !== currentIndex) {
          dispatchSb({
            type: 'MOVE_SCENE',
            sceneId: d.startScene.id,
            toIndex,
          });
        }
      }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [ui.pxPerFrame, ui.snapEnabled, ui.playheadFrame, live, dispatchSb]);

  return { begin, live, dragging: live !== null };
}
