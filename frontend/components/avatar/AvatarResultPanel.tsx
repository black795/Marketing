'use client';

import type { AvatarPhase, AvatarResult } from '@/types/avatar';
import LoadingButton from '@/components/loading/LoadingButton';
import Spinner from '@/components/loading/Spinner';

interface AvatarResultPanelProps {
  phase: AvatarPhase;
  statusMessage: string;
  elapsedMs: number;
  result: AvatarResult | null;
  error: string | null;
  /** Cancela una generación en curso. */
  onCancel: () => void;
  /** Vuelve a generar (mismo formulario) — usado para retry y "otra toma". */
  onRegenerate: () => void;
}

const ACTIVE_PHASES: AvatarPhase[] = [
  'connecting',
  'queued',
  'processing',
  'rendering',
];

/** Pasos visibles del timeline de estado. */
const STEPS: { phase: AvatarPhase; label: string }[] = [
  { phase: 'queued', label: 'En cola' },
  { phase: 'processing', label: 'Procesando' },
  { phase: 'rendering', label: 'Renderizando' },
  { phase: 'completed', label: 'Completado' },
];

function stepIndex(phase: AvatarPhase): number {
  switch (phase) {
    case 'connecting':
    case 'queued':
      return 0;
    case 'processing':
      return 1;
    case 'rendering':
      return 2;
    case 'completed':
      return 3;
    default:
      return -1;
  }
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Panel de estado + resultado del modo Avatar. Muestra el timeline en vivo
 * mientras se genera, el reproductor cuando termina, o el error con retry
 * si falla.
 */
export default function AvatarResultPanel({
  phase,
  statusMessage,
  elapsedMs,
  result,
  error,
  onCancel,
  onRegenerate,
}: AvatarResultPanelProps) {
  const isActive = ACTIVE_PHASES.includes(phase);
  const currentStep = stepIndex(phase);

  // -------- Estado: generando --------
  if (isActive) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Spinner size={20} className="text-brand-pink" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800">
              Generando el video del avatar
            </p>
            <p className="truncate text-xs text-neutral-500">
              {statusMessage || 'Conectando con el worker…'}
            </p>
          </div>
          <span className="ml-auto shrink-0 tabular-nums text-xs font-semibold text-neutral-500">
            {formatElapsed(elapsedMs)}
          </span>
        </div>

        {/* Timeline */}
        <ol className="mb-4 flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const done = currentStep > idx;
            const active = currentStep === idx;
            return (
              <li key={step.phase} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-center">
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      done || active ? 'bg-brand-pink' : 'bg-neutral-200'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    active
                      ? 'text-brand-pink'
                      : done
                      ? 'text-neutral-600'
                      : 'text-neutral-300'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-end">
          <LoadingButton variant="danger" onClick={onCancel}>
            Cancelar generación
          </LoadingButton>
        </div>
      </div>
    );
  }

  // -------- Estado: error --------
  if (phase === 'failed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/60 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">
            ⚠️
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              No se pudo generar el avatar
            </p>
            <p className="mt-1 text-xs text-red-700">
              {error || 'Error desconocido durante la generación.'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <LoadingButton variant="primary" onClick={onRegenerate}>
            Reintentar
          </LoadingButton>
        </div>
      </div>
    );
  }

  // -------- Estado: cancelado --------
  if (phase === 'cancelled') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <p className="text-sm font-semibold text-amber-800">
          Generación cancelada
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Cancelaste el render. Puedes volver a generarlo cuando quieras.
        </p>
        <div className="mt-4 flex justify-end">
          <LoadingButton variant="primary" onClick={onRegenerate}>
            Generar de nuevo
          </LoadingButton>
        </div>
      </div>
    );
  }

  // -------- Estado: completado --------
  if (phase === 'completed' && result) {
    const playUrl = result.localUrl || result.videoUrl;
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">
            ✅ Avatar generado
          </p>
          {result.localUrl && (
            <span
              title="Servido desde el backend local — no expira"
              className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            >
              ✓ Local
            </span>
          )}
        </div>

        <div className="mx-auto max-w-sm overflow-hidden rounded-lg bg-neutral-900">
          <video
            src={playUrl}
            controls
            loop
            playsInline
            className="h-full w-full"
            style={{ aspectRatio: '9 / 16' }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <a
            href={playUrl}
            download={`avatar_${result.jobId}.mp4`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-pink px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600"
          >
            ↓ Descargar
          </a>
          <LoadingButton variant="secondary" onClick={onRegenerate}>
            ↻ Generar otra toma
          </LoadingButton>
          {result.localUrl && result.videoUrl !== result.localUrl && (
            <a
              href={result.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-neutral-400 hover:text-neutral-600"
            >
              (origen Replicate)
            </a>
          )}
        </div>
      </div>
    );
  }

  // -------- Estado: idle --------
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center">
      <p className="text-sm font-semibold text-neutral-600">
        Tu avatar aparecerá aquí
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Completa la imagen y el guion, y pulsa “Generar avatar”.
      </p>
    </div>
  );
}
