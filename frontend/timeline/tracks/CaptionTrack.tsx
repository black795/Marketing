'use client';

import type { Scene } from '@/editing';
import { useTimelineUi } from '../store/context';
import { framesToPx, MIN_CLIP_PX } from '../utils/pixels';
import { TRACK_METAS } from '../types/ui';
import TrackRow from './TrackRow';

interface Props {
  scenes: Scene[];
  widthPx: number;
  heightPx: number;
}

const META = TRACK_METAS.find((m) => m.id === 'captions')!;

export default function CaptionTrack({ scenes, widthPx, heightPx }: Props) {
  const { ui } = useTimelineUi();
  return (
    <TrackRow widthPx={widthPx} heightPx={heightPx} tone={ui.mutedTracks.includes('captions') ? 'muted' : 'default'}>
      {scenes.flatMap((scene) =>
        scene.captions.map((c) => {
          const xPx = framesToPx(c.startFrame, ui.pxPerFrame);
          const w = Math.max(framesToPx(c.endFrame - c.startFrame, ui.pxPerFrame), MIN_CLIP_PX);
          return (
            <div
              key={c.id}
              className={`absolute top-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white ${META.color}`}
              style={{ left: xPx, width: w, height: heightPx - 8 }}
              title={c.text}
            >
              <span className="truncate">{c.text}</span>
            </div>
          );
        })
      )}
    </TrackRow>
  );
}
