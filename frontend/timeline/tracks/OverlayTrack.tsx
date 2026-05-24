'use client';

import type { Scene } from '@/editing';
import { useTimelineUi } from '../store/context';
import { framesToPx, MIN_CLIP_PX } from '../utils/pixels';
import { TRACK_METAS } from '../types/ui';
import TrackRow from './TrackRow';

const META = TRACK_METAS.find((m) => m.id === 'overlays')!;

export default function OverlayTrack({
  scenes,
  widthPx,
  heightPx,
}: {
  scenes: Scene[];
  widthPx: number;
  heightPx: number;
}) {
  const { ui } = useTimelineUi();
  return (
    <TrackRow widthPx={widthPx} heightPx={heightPx}>
      {scenes.flatMap((scene) =>
        scene.overlays.map((o) => {
          const xPx = framesToPx(o.startFrame, ui.pxPerFrame);
          const w = Math.max(framesToPx(o.endFrame - o.startFrame, ui.pxPerFrame), MIN_CLIP_PX);
          return (
            <div
              key={o.id}
              className={`absolute top-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white ${META.color}`}
              style={{ left: xPx, width: w, height: heightPx - 8 }}
              title={`${o.kind} overlay`}
            >
              <span className="truncate">{o.kind}</span>
            </div>
          );
        })
      )}
    </TrackRow>
  );
}
