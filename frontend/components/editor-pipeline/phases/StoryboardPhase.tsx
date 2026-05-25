'use client';

import { useEffect } from 'react';
import StoryboardLoader from '@/app/storyboard/StoryboardLoader';

/**
 * Fase 3 — Storyboard. Embebe el StoryboardLoader existente (mismo componente
 * que sirve a /storyboard). La fase se marca como "tocada" en el primer mount.
 */
export default function StoryboardPhase({
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
      <StoryboardLoader projectId={projectId} />
    </div>
  );
}
