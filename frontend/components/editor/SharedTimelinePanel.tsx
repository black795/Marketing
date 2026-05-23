'use client';

import { useEffect, useRef, useState } from 'react';
import { loadTimeline } from '@/lib/captions-api';
import type { TimelineDocument } from '@/types/timeline';
import LoadingButton from '@/components/loading/LoadingButton';

/**
 * Panel compartido por ambos editores (Remotion y Captions). Carga el
 * `timeline.json` de un proyecto y muestra su contenido — demuestra que
 * los dos editores consumen exactamente la misma fuente de verdad.
 *
 * El editor interactivo en sí (drag, preview, render) es la siguiente fase;
 * este panel es el punto de integración ya funcional sobre el timeline.
 */
export default function SharedTimelinePanel({
  mode,
  initialProjectId,
}: {
  mode: 'remotion' | 'captions';
  /** Pre-carga este projectId al montar (lo pasa /scripts vía /editor?projectId=…). */
  initialProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCaptions = mode === 'captions';

  async function handleLoad(idOverride?: string) {
    const id = (idOverride ?? projectId).trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setTimeline(null);
    try {
      const doc = await loadTimeline(id);
      if (!doc) {
        setError(
          `No hay timeline.json para "${id}". Genera el contenido primero o construye el timeline desde sus escenas.`
        );
      } else {
        setTimeline(doc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el timeline');
    } finally {
      setLoading(false);
    }
  }

  // Auto-carga si llegamos con ?projectId=… desde /scripts → /editor.
  // El ref evita doble-fetch por React StrictMode en dev.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (initialProjectId && initialProjectId.trim().length > 0) {
      autoLoadedRef.current = true;
      handleLoad(initialProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  return (
    <div className="space-y-5">
      <div
        className={`rounded-md px-4 py-3 text-xs ${
          isCaptions
            ? 'bg-brand-pink/10 text-brand-pink'
            : 'bg-brand-yellow/40 text-neutral-700'
        }`}
      >
        {isCaptions
          ? '✨ Editor de Captions — añadirá subtítulos dinámicos, karaoke y estilos virales sobre este timeline. Interfaz interactiva: próxima fase.'
          : '🎬 Editor Remotion — montaje y render programático sobre este timeline. Interfaz interactiva: próxima fase.'}{' '}
        El timeline que ves abajo es el mismo que consumen ambos editores.
      </div>

      {/* Cargar timeline */}
      <div>
        <label
          htmlFor="timeline-project"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          ID del proyecto
        </label>
        <div className="flex gap-2">
          <input
            id="timeline-project"
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoad();
            }}
            placeholder="Ej: de_los_andes_al_pacifico"
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
          <LoadingButton
            variant="primary"
            onClick={() => handleLoad()}
            loading={loading}
            loadingLabel="Cargando…"
            disabled={projectId.trim().length === 0}
          >
            Cargar timeline
          </LoadingButton>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Resumen del timeline */}
      {timeline && (
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              {timeline.title}
            </p>
            <p className="text-xs text-neutral-500">
              {timeline.width}×{timeline.height} · {timeline.fps}fps ·{' '}
              {(timeline.durationFrames / timeline.fps).toFixed(1)}s ·{' '}
              fuente: {timeline.metadata.source}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-neutral-200 text-center">
            <Stat label="Clips" value={timeline.clips.length} />
            <Stat label="Captions" value={timeline.captions.length} />
            <Stat label="Frames" value={timeline.durationFrames} />
          </div>

          <ol className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
            {timeline.clips.map((clip) => {
              const caption = timeline.captions.find(
                (c) => c.startFrame === clip.startFrame
              );
              return (
                <li key={clip.id} className="flex gap-3 px-4 py-2.5 text-xs">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-pink text-[10px] font-bold text-white">
                    {clip.sceneNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-700">
                      {clip.kind === 'video' ? '🎞️ Video' : '🖼️ Imagen'} ·{' '}
                      {clip.durationFrames} frames · transición:{' '}
                      {clip.transitionIn}
                    </p>
                    {caption && (
                      <p className="mt-0.5 truncate text-neutral-500">
                        💬 {caption.text}{' '}
                        <span className="text-neutral-400">
                          ({caption.words.length} palabras)
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-3">
      <p className="text-lg font-bold text-neutral-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
    </div>
  );
}
