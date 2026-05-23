'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  listCaptionTemplates,
  loadTimeline,
  streamCaptionJob,
} from '@/lib/captions-api';
import { StreamCancelledError } from '@/lib/api';
import { dlog, dwarn, derror } from '@/lib/debug-log';
import type {
  CaptionTemplate,
  CaptionJobPhase,
  CaptionJobResult,
} from '@/types/captions';
import type { TimelineDocument } from '@/types/timeline';
import LoadingButton from '@/components/loading/LoadingButton';
import ProgressBar from '@/components/loading/ProgressBar';
import Spinner from '@/components/loading/Spinner';

/** Fases en las que el job está en curso (UI bloqueada, botón = cancelar). */
const ACTIVE: CaptionJobPhase[] = [
  'connecting',
  'uploading',
  'submitting',
  'processing',
  'finalizing',
];

/**
 * Captions Editor — fase 2. Subtitula un video terminado con la API de
 * captions: elige una plantilla de estilo, pega la URL del video y el
 * backend hace submit + polling + descarga. La API key nunca llega aquí.
 *
 * Si llega con `initialProjectId` (desde /scripts → /editor), carga el
 * timeline del proyecto y ofrece los videos de las escenas como atajos
 * para no tener que pegar URLs a mano.
 */
export default function CaptionsEditorStudio({
  initialProjectId,
}: {
  initialProjectId?: string;
} = {}) {
  // ---- Plantillas ----
  const [templates, setTemplates] = useState<CaptionTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // ---- Entrada ----
  const [videoUrl, setVideoUrl] = useState('');

  // ---- Estado del job ----
  const [phase, setPhase] = useState<CaptionJobPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<CaptionJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isActive = ACTIVE.includes(phase);

  // ---- Timeline del proyecto (si llegamos desde /scripts) ----
  const [projectTimeline, setProjectTimeline] = useState<TimelineDocument | null>(
    null
  );
  const [projectTimelineError, setProjectTimelineError] = useState<string | null>(
    null
  );

  const timelineLoadedRef = useRef(false);
  useEffect(() => {
    if (timelineLoadedRef.current) return;
    if (!initialProjectId || initialProjectId.trim().length === 0) return;
    timelineLoadedRef.current = true;
    (async () => {
      try {
        const doc = await loadTimeline(initialProjectId);
        if (!doc) {
          setProjectTimelineError(
            `Sin timeline para "${initialProjectId}". Vuelve a "Continuar al editor".`
          );
        } else {
          setProjectTimeline(doc);
          dlog('captions', `timeline del proyecto cargado (${doc.clips.length} clips)`);
        }
      } catch (err) {
        setProjectTimelineError(
          err instanceof Error ? err.message : 'No se pudo cargar el timeline'
        );
      }
    })();
  }, [initialProjectId]);

  const projectVideoClips =
    projectTimeline?.clips.filter(
      (c) => c.kind === 'video' && typeof c.src === 'string' && c.src.length > 0
    ) ?? [];

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const list = await listCaptionTemplates();
      setTemplates(list);
      if (list.length > 0) setSelectedTemplateId((c) => c ?? list[0].id);
      dlog('captions', `${list.length} plantillas cargadas`);
    } catch (err) {
      setTemplatesError(
        err instanceof Error ? err.message : 'No se pudieron cargar las plantillas'
      );
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Aborta el job si el componente se desmonta.
  useEffect(() => () => abortRef.current?.abort(), []);

  const canGenerate =
    !isActive && !!selectedTemplateId && videoUrl.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplateId || videoUrl.trim().length === 0 || isActive) return;

    setError(null);
    setWarning(null);
    setResult(null);
    setProgress(null);
    setStatusMessage('Conectando con el gateway…');
    setPhase('connecting');

    const abort = new AbortController();
    abortRef.current = abort;
    dlog('captions', 'job iniciado', { templateId: selectedTemplateId });

    try {
      const outcome = await streamCaptionJob(
        { videoUrl: videoUrl.trim(), captionTemplateId: selectedTemplateId },
        {
          onStatus: ({ phase: p, progress: pr, message }) => {
            setPhase(p);
            setProgress(pr);
            if (message) setStatusMessage(message);
          },
          onWarning: (msg) => {
            dwarn('captions', `warning: ${msg}`);
            setWarning(msg);
          },
        },
        abort.signal
      );

      if (outcome.status === 'completed') {
        setResult(outcome.result);
        setPhase('completed');
      } else if (outcome.status === 'failed') {
        setError(outcome.error);
        setPhase('failed');
      } else {
        setPhase('cancelled');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        dwarn('captions', 'job cancelado por el cliente');
        setPhase('cancelled');
      } else {
        const msg = err instanceof Error ? err.message : 'Error inesperado';
        derror('captions', 'excepción en el job', err);
        setError(msg);
        setPhase('failed');
      }
    } finally {
      abortRef.current = null;
    }
  }, [selectedTemplateId, videoUrl, isActive]);

  function handleCancel() {
    dlog('captions', 'cancelación solicitada');
    abortRef.current?.abort();
    setStatusMessage('Cancelando…');
  }

  // -------- Render --------
  return (
    <div className="space-y-6">
      {/* 1. Plantilla de estilo */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Step n={1} /> Estilo de subtítulos
        </h3>

        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner size={16} className="text-brand-pink" /> Cargando plantillas…
          </div>
        ) : templatesError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-xs text-red-700">
            <p className="font-semibold">No se pudieron cargar las plantillas.</p>
            <p className="mt-0.5">{templatesError}</p>
            <p className="mt-2 text-red-600">
              Revisa la API key en{' '}
              <Link href="/settings" className="font-semibold underline">
                ⚙️ Configuración de APIs
              </Link>{' '}
              y vuelve a intentar.
            </p>
            <button
              type="button"
              onClick={loadTemplates}
              className="mt-2 rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-50"
            >
              Reintentar
            </button>
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-neutral-500">
            El proveedor no devolvió plantillas de estilo.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((t) => {
              const active = t.id === selectedTemplateId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => setSelectedTemplateId(t.id)}
                    onMouseEnter={(e) =>
                      e.currentTarget.querySelector('video')?.play().catch(() => {})
                    }
                    onMouseLeave={(e) => {
                      const v = e.currentTarget.querySelector('video');
                      if (v) {
                        v.pause();
                        v.currentTime = 0;
                      }
                    }}
                    className={`group block w-full overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${
                      active
                        ? 'border-brand-pink ring-2 ring-brand-pink/30'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div
                      className="relative w-full bg-neutral-900"
                      style={{ aspectRatio: '9 / 16' }}
                    >
                      {t.previewUrl ? (
                        <video
                          src={t.previewUrl}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                          sin preview
                        </div>
                      )}
                      {active && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center rounded-full bg-brand-pink px-1.5 py-0.5 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs font-semibold text-neutral-700">
                      {t.name}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2. Video de origen */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Step n={2} /> Video a subtitular
        </h3>

        {/* Videos del proyecto — atajo cuando se llega desde /scripts */}
        {projectTimeline && projectVideoClips.length > 0 && (
          <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Videos del proyecto{' '}
              <span className="font-normal normal-case text-neutral-400">
                · {projectTimeline.title}
              </span>
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {projectVideoClips.map((clip) => {
                const active = clip.src === videoUrl;
                return (
                  <li key={clip.id}>
                    <button
                      type="button"
                      disabled={isActive || !clip.src}
                      onClick={() => clip.src && setVideoUrl(clip.src)}
                      title={clip.src ?? ''}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                        active
                          ? 'border-brand-pink bg-brand-pink text-white'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-pink hover:text-brand-pink'
                      }`}
                    >
                      🎞️ Escena {clip.sceneNumber}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {projectTimelineError && (
          <p className="mb-2 text-[11px] text-amber-700">{projectTimelineError}</p>
        )}

        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={isActive}
          placeholder="https://… URL de un MP4 vertical (9:16, máx 50 MB)"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
        />
        <p className="mt-1 text-[11px] text-neutral-400">
          {projectTimeline
            ? 'Elige un video del proyecto arriba o pega cualquier otra URL. 9:16, MP4/MOV, máx 50 MB.'
            : 'Pega la URL de un video ya generado (p. ej. el resultado del modo Avatar o un render). Debe ser 9:16, MP4/MOV, máximo 50 MB.'}
        </p>
      </section>

      {/* 3. Acción */}
      <section>
        {isActive ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <Spinner size={18} className="text-brand-pink" />
              <p className="flex-1 text-sm font-semibold text-neutral-800">
                {statusMessage || 'Procesando…'}
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {phase}
              </span>
            </div>
            <ProgressBar
              value={progress != null ? progress / 100 : null}
              showPercent
              label={progress != null ? `${progress}%` : 'En proceso…'}
            />
            <div className="mt-3 flex justify-end">
              <LoadingButton variant="danger" onClick={handleCancel}>
                Cancelar
              </LoadingButton>
            </div>
          </div>
        ) : (
          <LoadingButton
            variant="primary"
            fullWidth
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            ✨ Generar captions
          </LoadingButton>
        )}

        {warning && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            ⚠ {warning}
          </p>
        )}
      </section>

      {/* 4. Resultado */}
      {phase === 'failed' && error && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-semibold text-red-800">
            No se pudieron generar los captions
          </p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <div className="mt-3 flex justify-end">
            <LoadingButton variant="primary" onClick={handleGenerate}>
              Reintentar
            </LoadingButton>
          </div>
        </div>
      )}

      {phase === 'cancelled' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          Job cancelado. Puedes volver a generarlo cuando quieras.
        </div>
      )}

      {phase === 'completed' && result && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-800">
            ✅ Video subtitulado listo
          </p>
          <div className="mx-auto max-w-xs overflow-hidden rounded-lg bg-neutral-900">
            <video
              src={result.localUrl || result.videoUrl}
              controls
              loop
              playsInline
              className="h-full w-full"
              style={{ aspectRatio: '9 / 16' }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <a
              href={result.localUrl || result.videoUrl}
              download={`captioned_${result.jobId}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-pink px-3 py-2 text-sm font-semibold text-white hover:bg-pink-600"
            >
              ↓ Descargar
            </a>
            <LoadingButton variant="secondary" onClick={handleGenerate}>
              ↻ Generar de nuevo
            </LoadingButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-[10px] font-bold text-white">
      {n}
    </span>
  );
}
