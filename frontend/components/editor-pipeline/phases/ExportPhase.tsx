'use client';

import { useEffect } from 'react';
import ExportLoader from '@/app/export/ExportLoader';

/**
 * Fase 8 — Export. Embebe ExportLoader: render incremental con cache de
 * segmentos, 7 presets de plataforma (TikTok / Reels / Shorts / LinkedIn /
 * 1:1 / 16:9), jobs paralelos.
 */
export default function ExportPhase({
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
      <ExportLoader projectId={projectId} />
    </div>
  );
}
