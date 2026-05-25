'use client';

import { useEffect } from 'react';
import CaptionsEditorStudio from '@/components/editor/CaptionsEditorStudio';

/**
 * Fase 6 — Captions. Embebe CaptionsEditorStudio: estilos virales (TikTok,
 * karaoke, word highlight), submit + polling + descarga vía backend.
 */
export default function CaptionsPhase({
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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <CaptionsEditorStudio initialProjectId={projectId} />
    </div>
  );
}
