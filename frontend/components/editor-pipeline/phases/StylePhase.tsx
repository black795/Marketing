'use client';

import { useEffect } from 'react';
import StylesLoader from '@/app/styles/StylesLoader';

/**
 * Fase 5 — Style Engine. Embebe StylesLoader: 8 StylePacks virales con live
 * preview por escena (TikTok / Hormozi / MrBeast / Podcast / Documental /
 * Gaming / Luxury / Anime).
 */
export default function StylePhase({
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
      <StylesLoader projectId={projectId} />
    </div>
  );
}
