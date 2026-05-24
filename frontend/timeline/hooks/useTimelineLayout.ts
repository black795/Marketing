/**
 * Convierte el proyecto + UI state en una "tabla de layout" lista para render.
 *
 *   timelineWidthPx — anchura total del canvas en px (suma de escenas × pxPerFrame).
 *   sceneLayout     — por escena: {sceneId, x, width, role, included, …}
 *   visibleRange    — frames visibles (para skipping de waveforms).
 */
import { useMemo } from 'react';
import type { Scene, TimelineProject } from '@/editing';
import { useTimelineUi } from '../store/context';
import { framesToPx, MIN_CLIP_PX } from '../utils/pixels';
import { visibleFrameRange } from '../utils/virtualization';

export interface SceneLayoutEntry {
  sceneId: string;
  scene: Scene;
  /** Posición absoluta en px desde el inicio del canvas. */
  xPx: number;
  /** Anchura visible en px (>= MIN_CLIP_PX). */
  widthPx: number;
}

export function useTimelineLayout(
  project: TimelineProject,
  viewportWidthPx: number
) {
  const { ui } = useTimelineUi();
  const { pxPerFrame, scrollLeft } = ui;

  return useMemo(() => {
    const sceneLayout: SceneLayoutEntry[] = project.scenes.map((scene) => {
      const xPx = framesToPx(scene.startFrame, pxPerFrame);
      const widthPx = Math.max(
        framesToPx(scene.durationFrames, pxPerFrame),
        MIN_CLIP_PX
      );
      return { sceneId: scene.id, scene, xPx, widthPx };
    });

    const totalFrames = project.metadata.durationFrames || (() => {
      const last = project.scenes[project.scenes.length - 1];
      return last ? last.endFrame : 0;
    })();
    const timelineWidthPx = Math.max(
      framesToPx(totalFrames, pxPerFrame) + 200, // padding al final
      viewportWidthPx
    );

    const visibleRange = visibleFrameRange(scrollLeft, viewportWidthPx, pxPerFrame);

    return { sceneLayout, timelineWidthPx, visibleRange };
  }, [project.scenes, project.metadata.durationFrames, pxPerFrame, scrollLeft, viewportWidthPx]);
}
