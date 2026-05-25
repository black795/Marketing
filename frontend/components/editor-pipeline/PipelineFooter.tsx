'use client';

import type { Phase } from '@/lib/editor-pipeline/types';
import {
  saveStatusLabel,
  type SaveStatus,
} from '@/lib/editor-pipeline/usePipelineProject';

interface Props {
  current: Phase;
  prev: Phase | null;
  next: Phase | null;
  canContinue: boolean;
  saveStatus: SaveStatus;
  onBack: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  /** Etiqueta personalizada del botón continuar (defaults a "Continuar →"). */
  continueLabel?: string;
}

/**
 * Footer global del pipeline. Fijo en bottom para que el usuario nunca
 * pierda de vista la navegación.
 */
export default function PipelineFooter({
  current,
  prev,
  next,
  canContinue,
  saveStatus,
  onBack,
  onContinue,
  onSkip,
  continueLabel = 'Continuar →',
}: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!prev}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-pink hover:text-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Atrás
        </button>
        <SaveIndicator status={saveStatus} />
        <span className="ml-auto text-[11px] text-neutral-500">
          Fase actual: <strong className="text-neutral-800">{current}</strong>
        </span>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
          >
            Saltar
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!next || !canContinue}
          className="inline-flex items-center gap-1 rounded-md bg-brand-pink px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {next ? continueLabel : 'Final'}
        </button>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const label = saveStatusLabel(status);
  const color =
    status === 'saved'
      ? 'text-emerald-600'
      : status === 'error'
      ? 'text-red-600'
      : 'text-neutral-500';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${color}`}>
      {status === 'saving' || status === 'loading' ? (
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      ) : status === 'saved' ? (
        <span aria-hidden>●</span>
      ) : status === 'error' ? (
        <span aria-hidden>⚠</span>
      ) : null}
      {label}
    </span>
  );
}
