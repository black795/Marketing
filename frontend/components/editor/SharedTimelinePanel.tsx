'use client';

import { useEffect, useRef, useState } from 'react';
import { loadTimeline } from '@/lib/captions-api';
import {
  getLastRender,
  streamRender,
  type RenderProgress,
  type RenderResult,
} from '@/lib/render-api';
import { StreamCancelledError } from '@/lib/api';
import type { TimelineDocument } from '@/types/timeline';
import LoadingButton from '@/components/loading/LoadingButton';
import ProgressBar from '@/components/loading/ProgressBar';

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
            ? 'bg-[var(--blue)]/10 text-[var(--blue-hi)]'
            : 'bg-brand-yellow/40 text-[var(--fg-2)]'
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
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]"
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
            className="flex-1 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg-1)] focus:border-[var(--blue)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)]"
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
        {error && <p className="mt-2 text-xs text-[var(--red-hi)]">{error}</p>}
      </div>

      {/* Resumen del timeline */}
      {timeline && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)]">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--fg-1)]">
              {timeline.title}
            </p>
            <p className="text-xs text-[var(--fg-3)]">
              {timeline.width}×{timeline.height} · {timeline.fps}fps ·{' '}
              {(timeline.durationFrames / timeline.fps).toFixed(1)}s ·{' '}
              fuente: {timeline.metadata.source}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[var(--line)] text-center">
            <Stat label="Clips" value={timeline.clips.length} />
            <Stat label="Captions" value={timeline.captions.length} />
            <Stat label="Frames" value={timeline.durationFrames} />
          </div>

          <ol className="max-h-72 divide-y divide-[var(--line)] overflow-y-auto">
            {timeline.clips.map((clip) => {
              const caption = timeline.captions.find(
                (c) => c.startFrame === clip.startFrame
              );
              return (
                <li key={clip.id} className="flex gap-3 px-4 py-2.5 text-xs">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-[10px] font-bold text-white">
                    {clip.sceneNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--fg-2)]">
                      {clip.kind === 'video' ? '🎞️ Video' : '🖼️ Imagen'} ·{' '}
                      {clip.durationFrames} frames · transición:{' '}
                      {clip.transitionIn}
                    </p>
                    {caption && (
                      <p className="mt-0.5 truncate text-[var(--fg-3)]">
                        💬 {caption.text}{' '}
                        <span className="text-[var(--fg-4)]">
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

      {/* Render — solo para el modo Remotion. */}
      {!isCaptions && timeline && (
        <RenderSection
          projectId={(initialProjectId ?? projectId).trim()}
          hasCaptions={timeline.captions.length > 0}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Render section — produce el MP4 final con ffmpeg + subtítulos quemados.
// ---------------------------------------------------------------------------

function phaseLabel(phase: RenderProgress['phase']): string {
  switch (phase) {
    case 'preparing':
      return 'Preparando…';
    case 'downloading':
      return 'Descargando clips';
    case 'building-captions':
      return 'Compilando subtítulos';
    case 'encoding':
      return 'Renderizando con ffmpeg';
    case 'done':
      return 'Completado';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelado';
    default:
      return phase;
  }
}

function RenderSection({
  projectId,
  hasCaptions,
}: {
  projectId: string;
  hasCaptions: boolean;
}) {
  const [lastRender, setLastRender] = useState<RenderResult | null>(null);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Carga el último render si existe (al montar y cuando cambia el proyecto).
  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (lastLoadedRef.current === projectId) return;
    lastLoadedRef.current = projectId;
    getLastRender(projectId)
      .then((r) => setLastRender(r))
      .catch(() => {
        /* 404 o red → simplemente no hay render previo */
      });
  }, [projectId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleRender() {
    if (!projectId || running) return;
    setError(null);
    setProgress({ phase: 'connecting', message: 'Conectando…' });
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const outcome = await streamRender(
        projectId,
        { burnCaptions },
        {
          onProgress: (p) => setProgress(p),
        },
        ctrl.signal
      );

      if (outcome.status === 'done') {
        setLastRender(outcome.render);
        setProgress({
          phase: 'done',
          message: 'Render completo',
          progress: 1,
        });
      } else if (outcome.status === 'cancelled') {
        setProgress({ phase: 'cancelled', message: 'Render cancelado' });
      } else {
        setError(outcome.error);
        setProgress({ phase: 'error', message: outcome.error });
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setProgress({ phase: 'cancelled', message: 'Render cancelado' });
      } else {
        const message =
          err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        setProgress({ phase: 'error', message });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--fg-1)]">
          🎞️ Render del video editado
        </p>
        <p className="text-xs text-[var(--fg-3)]">
          Concatena los clips del timeline con ffmpeg y produce un MP4 final.
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={burnCaptions}
            onChange={(e) => setBurnCaptions(e.target.checked)}
            disabled={running || !hasCaptions}
            className="mt-0.5 accent-[var(--blue)]"
          />
          <span className={hasCaptions ? 'text-[var(--fg-2)]' : 'text-[var(--fg-4)]'}>
            Quemar subtítulos del timeline sobre el video (libass)
            {!hasCaptions && (
              <span className="ml-1 text-[var(--fg-4)]">
                — el timeline no trae captions
              </span>
            )}
          </span>
        </label>

        <div className="flex gap-2">
          <LoadingButton
            variant="primary"
            onClick={handleRender}
            loading={running}
            loadingLabel="Renderizando…"
            disabled={!projectId || running}
          >
            {lastRender ? 'Re-renderizar' : 'Renderizar video editado'}
          </LoadingButton>
          {running && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-[var(--line-strong)] px-3 py-2 text-xs font-semibold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
            >
              Cancelar
            </button>
          )}
        </div>

        {progress && (running || progress.phase === 'error' || progress.phase === 'cancelled') && (
          <ProgressBar
            value={
              progress.phase === 'encoding' ||
              progress.phase === 'downloading'
                ? progress.progress ?? null
                : progress.phase === 'done'
                  ? 1
                  : null
            }
            label={phaseLabel(progress.phase)}
            detail={progress.message}
          />
        )}

        {error && (
          <p className="rounded-md bg-[var(--red-soft)] px-3 py-2 text-xs text-[var(--red-hi)]">
            {error}
          </p>
        )}

        {lastRender && (
          <div className="space-y-2 rounded-md border border-[var(--line)] bg-[var(--bg-1)] p-3">
            <p className="text-xs font-semibold text-[var(--fg-2)]">
              ✅ Última salida ({new Date(lastRender.renderedAt).toLocaleString()})
            </p>
            <p className="text-[11px] text-[var(--fg-3)]">
              {lastRender.width}×{lastRender.height} · {lastRender.fps}fps ·{' '}
              {lastRender.durationSeconds.toFixed(1)}s · {lastRender.clipCount}{' '}
              clips · captions: {lastRender.burnedCaptions ? 'sí' : 'no'}
            </p>
            <video
              key={lastRender.url}
              src={lastRender.url}
              controls
              playsInline
              className="aspect-[9/16] w-48 rounded-md bg-black"
            />
            <div className="flex flex-wrap gap-2">
              <a
                href={lastRender.url}
                download
                className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
              >
                ⬇ Descargar MP4
              </a>
              <a
                href={lastRender.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
              >
                Abrir en nueva pestaña
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-3">
      <p className="text-lg font-bold text-[var(--fg-1)]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-4)]">
        {label}
      </p>
    </div>
  );
}
