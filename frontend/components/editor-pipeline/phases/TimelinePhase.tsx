'use client';

import { useEffect } from 'react';
import TimelineLoader from '@/app/timeline/TimelineLoader';

/**
 * Fase 4 — Smart Timeline. Embebe TimelineLoader: 7 pistas (video/voz/música/
 * sfx/captions/...), trim/split/snap/scrub.
 */
export default function TimelinePhase({
  projectId,
  onTouched,
}: {
  projectId: string;
  onTouched: () => void;
}) {
  useEffect(() => {
    onTouched();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <TimelineLoader projectId={projectId} />
    </div>
  );
}
