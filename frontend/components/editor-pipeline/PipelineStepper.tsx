'use client';

import {
  PHASES,
  PHASE_LABEL,
  type Phase,
  type PhaseStatus,
} from '@/lib/editor-pipeline/types';

interface Props {
  current: Phase;
  status: Record<Phase, PhaseStatus>;
  onJump: (p: Phase) => void;
}

/**
 * Barra de pasos del pipeline. Cualquier paso es saltable — el orden es solo
 * sugerencia.
 */
export default function PipelineStepper({ current, status, onJump }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs">
      {PHASES.map((p, idx) => {
        const isActive = p === current;
        const st = status[p];
        const canJump = true;
        const isLast = idx === PHASES.length - 1;
        return (
          <li key={p} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => canJump && onJump(p)}
              disabled={!canJump}
              aria-current={isActive ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition ${
                isActive
                  ? 'bg-brand-pink text-white shadow-sm'
                  : st === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : st === 'visited'
                  ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  : st === 'skipped'
                  ? 'bg-neutral-100 text-neutral-400'
                  : 'bg-neutral-100 text-neutral-500'
              } ${canJump ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              <PhaseDot status={st} active={isActive} />
              {PHASE_LABEL[p]}
            </button>
            {!isLast && (
              <span aria-hidden="true" className="text-neutral-300">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PhaseDot({ status, active }: { status: PhaseStatus; active: boolean }) {
  if (active) {
    return <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />;
  }
  if (status === 'completed') {
    return <span aria-hidden>✓</span>;
  }
  if (status === 'skipped') {
    return <span aria-hidden>—</span>;
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />;
}
