'use client';

import { useEffect, useMemo, useState } from 'react';
import Spinner from '@/components/loading/Spinner';
import { loadTimeline } from '@/lib/captions-api';
import type { TimelineDocument } from '@/types/timeline';

/**
 * Fase 1 — Importar.
 *
 * Galería de lectura con los archivos del proyecto: videos, imágenes y audio.
 * Se alimenta del `timeline.json` que arma `/editor/manual` al subir clips.
 */
export default function ImportPhase({
  projectId,
  onTouched,
}: {
  projectId: string;
  onTouched: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadTimeline(projectId)
      .then((tl) => {
        if (cancelled) return;
        setTimeline(tl);
        onTouched();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando assets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onTouched no debe re-disparar; se ejecuta una sola vez al cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const { videos, images, audio } = useMemo(() => {
    const clips = timeline?.clips ?? [];
    return {
      videos: clips.filter((c) => c.kind === 'video' && !!c.src),
      images: clips.filter((c) => c.kind === 'image' && !!c.src),
      audio: timeline?.audio ?? null,
    };
  }, [timeline]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <Spinner size={18} className="text-brand-pink" />
        <span className="text-sm text-neutral-600">Cargando archivos importados…</span>
      </div>
    );
  }

  const totalItems = videos.length + images.length + (audio ? 1 : 0);

  if (totalItems === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-600">
          Todavía no hay archivos importados en este proyecto.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Volvé a <strong>Inicio → Edición</strong> y subí tus videos / imágenes.
        </p>
        {error && <p className="mt-3 text-xs text-red-600">⚠ {error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2 shadow-sm">
        <span className="text-xs font-semibold text-neutral-700">Archivos del proyecto</span>
        <span className="text-[11px] text-neutral-500">
          {videos.length} videos · {images.length} imágenes
          {audio ? ' · 1 audio' : ''}
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</p>
      )}

      {videos.length > 0 && (
        <Section title="Videos" emoji="🎞️" count={videos.length}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((clip) => (
              <MediaCard
                key={clip.id}
                label={`Clip #${clip.sceneNumber}`}
                sublabel={`${Math.round((clip.durationFrames / (timeline?.fps ?? 30)) * 10) / 10}s`}
              >
                <video
                  src={clip.src ?? undefined}
                  controls
                  muted
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    try {
                      v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
                    } catch {}
                  }}
                  className="h-full w-full bg-black object-cover"
                />
              </MediaCard>
            ))}
          </div>
        </Section>
      )}

      {images.length > 0 && (
        <Section title="Imágenes" emoji="🖼️" count={images.length}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((clip) => (
              <MediaCard key={clip.id} label={`Imagen #${clip.sceneNumber}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clip.src ?? undefined}
                  alt={`Imagen ${clip.sceneNumber}`}
                  className="h-full w-full bg-neutral-100 object-cover"
                />
              </MediaCard>
            ))}
          </div>
        </Section>
      )}

      {audio && (
        <Section title="Audio" emoji="🎵" count={1}>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs text-neutral-500">
              {audio.src.split('/').slice(-1)[0]}
            </p>
            <audio src={audio.src} controls className="w-full" />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  emoji,
  count,
  children,
}: {
  title: string;
  emoji: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          {emoji}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] text-neutral-400">({count})</span>
      </header>
      {children}
    </section>
  );
}

function MediaCard({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full">{children}</div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-semibold text-neutral-800">{label}</p>
        {sublabel && (
          <p className="truncate text-[11px] text-neutral-500">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
