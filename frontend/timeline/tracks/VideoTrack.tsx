'use client';

import { useStoryboard } from '@/storyboard';
import { pickThumbnail } from '@/storyboard';
import type { SceneLayoutEntry } from '../hooks/useTimelineLayout';
import TrackRow from './TrackRow';
import ClipBlock from './ClipBlock';
import { TRACK_METAS } from '../types/ui';
import { isInRange } from '../utils/virtualization';

interface Props {
  layout: SceneLayoutEntry[];
  widthPx: number;
  heightPx: number;
  visibleRange: { start: number; end: number };
}

const META = TRACK_METAS.find((m) => m.id === 'video')!;

export default function VideoTrack({ layout, widthPx, heightPx, visibleRange }: Props) {
  return (
    <TrackRow widthPx={widthPx} heightPx={heightPx}>
      {layout.map((entry) => {
        const inView = isInRange(entry.scene.startFrame, entry.scene.endFrame, visibleRange);
        return (
          <ClipBlock
            key={entry.scene.id}
            scene={entry.scene}
            xPx={entry.xPx}
            widthPx={entry.widthPx}
            heightPx={heightPx}
            label={`${String(entry.scene.sceneNumber).padStart(2, '0')} · ${entry.scene.role}`}
            color={META.color}
          >
            {inView ? <ThumbnailBg scene={entry.scene} /> : null}
          </ClipBlock>
        );
      })}
    </TrackRow>
  );
}

function ThumbnailBg({ scene }: { scene: SceneLayoutEntry['scene'] }) {
  const thumb = pickThumbnail(scene);
  if (!thumb) return null;
  if (thumb.kind === 'video') {
    return (
      <video
        src={thumb.src}
        muted
        playsInline
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={thumb.src}
      alt=""
      className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
      loading="lazy"
    />
  );
}
