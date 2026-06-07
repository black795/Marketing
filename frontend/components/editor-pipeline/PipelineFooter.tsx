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
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 20,
        borderTop: '1px solid var(--line)',
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={!prev}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 8,
            border: '1px solid var(--line-strong)',
            background: 'var(--bg-3)',
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: prev ? 'var(--fg-2)' : 'var(--fg-4)',
            cursor: prev ? 'pointer' : 'not-allowed',
            opacity: prev ? 1 : 0.5,
          }}
        >
          ← Atrás
        </button>
        <SaveIndicator status={saveStatus} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>
          Fase actual: <strong style={{ color: 'var(--fg-1)' }}>{current}</strong>
        </span>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'transparent',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fg-3)',
              cursor: 'pointer',
            }}
          >
            Saltar
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!next || !canContinue}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 8,
            background: !next || !canContinue ? 'var(--bg-4)' : 'var(--blue)',
            border: '1px solid ' + (!next || !canContinue ? 'var(--line-strong)' : 'var(--blue-lo)'),
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: !next || !canContinue ? 'var(--fg-4)' : '#fff',
            cursor: !next || !canContinue ? 'not-allowed' : 'pointer',
          }}
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
      ? 'var(--success)'
      : status === 'error'
      ? 'var(--red-hi)'
      : 'var(--fg-3)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color }}>
      {status === 'saving' || status === 'loading' ? (
        <span
          className="breath"
          style={{ display: 'inline-block', height: 8, width: 8, borderRadius: 999, background: 'currentColor' }}
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
