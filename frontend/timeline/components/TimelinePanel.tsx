'use client';

import { useEffect, useRef, useState } from 'react';
import { useStoryboard, useAutoSave } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import { useScrubbing } from '../hooks/useScrubbing';
import { useZoom } from '../hooks/useZoom';
import { useTimelineKeys } from '../hooks/useTimelineKeys';
import { TRACK_METAS, type TimelineTrackKind } from '../types/ui';

import TimelineToolbar from './TimelineToolbar';
import TimeRuler from './TimeRuler';
import Playhead from './Playhead';
import TimelineAiActions from './TimelineAiActions';

import TrackHeader from '../tracks/TrackHeader';
import VideoTrack from '../tracks/VideoTrack';
import AudioTrack from '../tracks/AudioTrack';
import CaptionTrack from '../tracks/CaptionTrack';
import OverlayTrack from '../tracks/OverlayTrack';
import EffectsTrack from '../tracks/EffectsTrack';

const HEADER_WIDTH_PX = 140;
const ROW_HEIGHT_PX = 52;
const RULER_HEIGHT_PX = 36;

/**
 * Panel principal del Smart Timeline. Layout:
 *
 *   ┌─ Toolbar ────────────────────────────────────────────┐
 *   │  Tools · Acciones · Snap · Zoom                       │
 *   ├──────┬───────────────────────────────────────────────┤
 *   │      │                Ruler + Scene Sections         │
 *   │      ├───────────────────────────────────────────────┤
 *   │  H   │  Video clips                                  │
 *   │  e   ├───────────────────────────────────────────────┤
 *   │  a   │  Voice waveform                               │
 *   │  d   ├───────────────────────────────────────────────┤
 *   │  e   │  Music · SFX · Captions · Overlays · Effects │
 *   │  r   │                                               │
 *   ├──────┴───────────────────────────────────────────────┤
 *   │  AI Actions (prompt + chips + sync + regen)          │
 *   └──────────────────────────────────────────────────────┘
 */
export default function TimelinePanel() {
  const { state: sb } = useStoryboard();
  const { ui } = useTimelineUi();
  const project = sb.project;

  // Reusamos el autosave del Storyboard — ambos editores comparten store.
  useAutoSave();
  useTimelineKeys();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportWidthPx, setViewportWidthPx] = useState(800);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w !== viewportWidthPx) setViewportWidthPx(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [viewportWidthPx]);

  const { sceneLayout, timelineWidthPx, visibleRange } = useTimelineLayout(
    project,
    viewportWidthPx
  );

  const scrub = useScrubbing(canvasRef);
  const { onWheel } = useZoom();

  // Tracks visibles (hiddenTracks lo override).
  const tracks: TimelineTrackKind[] = TRACK_METAS.map((m) => m.id).filter(
    (id) => !ui.hiddenTracks.includes(id)
  );

  const totalContentHeight = RULER_HEIGHT_PX + tracks.length * ROW_HEIGHT_PX;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[var(--line)] bg-[var(--bg-2)] shadow-sm">
      <TimelineToolbar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Cabeceras de pistas (lado izquierdo, fijo) */}
        <div className="flex w-[140px] shrink-0 flex-col" style={{ width: HEADER_WIDTH_PX }}>
          {/* Espacio bajo el ruler */}
          <div
            className="border-b border-r border-[var(--line)] bg-[var(--bg-1)]"
            style={{ height: RULER_HEIGHT_PX }}
          />
          {tracks.map((kind) => (
            <TrackHeader key={kind} kind={kind} heightPx={ROW_HEIGHT_PX} />
          ))}
        </div>

        {/* Canvas (ruler + tracks) — scrolleable */}
        <div
          ref={canvasRef}
          className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          onWheel={onWheel}
        >
          <div style={{ width: timelineWidthPx, height: totalContentHeight, position: 'relative' }}>
            <div
              className="sticky top-0"
              onMouseDown={(e) => scrub.onMouseDown(e)}
              style={{ width: timelineWidthPx, cursor: 'col-resize' }}
            >
              <TimeRuler widthPx={timelineWidthPx} />
            </div>

            {tracks.map((kind) => {
              if (kind === 'video') {
                return (
                  <VideoTrack
                    key={kind}
                    layout={sceneLayout}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                    visibleRange={visibleRange}
                  />
                );
              }
              if (kind === 'voice') {
                return (
                  <AudioTrack
                    key={kind}
                    kind="voice"
                    audioKind="voiceover"
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                    visibleRange={visibleRange}
                  />
                );
              }
              if (kind === 'music') {
                return (
                  <AudioTrack
                    key={kind}
                    kind="music"
                    audioKind="music"
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                    visibleRange={visibleRange}
                  />
                );
              }
              if (kind === 'sfx') {
                return (
                  <AudioTrack
                    key={kind}
                    kind="sfx"
                    audioKind="sfx"
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                    visibleRange={visibleRange}
                  />
                );
              }
              if (kind === 'captions') {
                return (
                  <CaptionTrack
                    key={kind}
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                  />
                );
              }
              if (kind === 'overlays') {
                return (
                  <OverlayTrack
                    key={kind}
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                  />
                );
              }
              if (kind === 'effects') {
                return (
                  <EffectsTrack
                    key={kind}
                    scenes={project.scenes}
                    widthPx={timelineWidthPx}
                    heightPx={ROW_HEIGHT_PX}
                  />
                );
              }
              return null;
            })}

            <Playhead heightPx={totalContentHeight} />
          </div>
        </div>
      </div>

      <TimelineAiActions />
    </div>
  );
}
