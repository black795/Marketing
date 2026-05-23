'use client';

import Spinner from '@/components/loading/Spinner';

/** Estado de un paso de preparación. */
export type PrepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PrepStep {
  id: string;
  label: string;
  status: PrepStatus;
}

interface PreparationOverlayProps {
  open: boolean;
  steps: PrepStep[];
  error?: string | null;
  onClose?: () => void;
}

/**
 * Overlay que se muestra mientras el Hub prepara el proyecto antes de
 * abrir el editor. Los pasos son REALES — cada uno corresponde a una
 * operación que se está awaitando (build timeline, save plan, etc.).
 */
export default function PreparationOverlay({
  open,
  steps,
  error,
  onClose,
}: PreparationOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preparando proyecto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white/95 p-6 shadow-2xl backdrop-blur">
        <header className="mb-4">
          <h2 className="text-base font-bold text-neutral-900">
            {error ? '⚠️ Algo salió mal' : '🚀 Preparando proyecto'}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {error
              ? 'No pudimos terminar la preparación.'
              : 'Estamos dejando todo listo para abrir el editor.'}
          </p>
        </header>

        <ol className="space-y-2">
          {steps.map((s) => (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                s.status === 'running'
                  ? 'border-brand-pink/40 bg-brand-pink/5 text-neutral-800'
                  : s.status === 'done'
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                  : s.status === 'error'
                  ? 'border-red-200 bg-red-50/60 text-red-800'
                  : 'border-neutral-200 bg-neutral-50/60 text-neutral-400'
              }`}
            >
              <StatusIcon status={s.status} />
              <span className="flex-1 font-medium">{s.label}</span>
            </li>
          ))}
        </ol>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {error && onClose && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: PrepStatus }) {
  if (status === 'running') {
    return <Spinner size={14} className="shrink-0 text-brand-pink" />;
  }
  if (status === 'done') {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white"
      >
        ✓
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
      >
        !
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-neutral-300"
    />
  );
}
