'use client';

import type { CSSProperties } from 'react';
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
    <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12, listStyle: 'none', margin: 0, padding: 0 }}>
      {PHASES.map((p, idx) => {
        const isActive = p === current;
        const st = status[p];
        const isLast = idx === PHASES.length - 1;
        const tone: CSSProperties = isActive
          ? { background: 'var(--blue)', color: '#fff', border: '1px solid var(--blue-lo)' }
          : st === 'completed'
          ? { background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid rgba(43,212,164,0.3)' }
          : st === 'visited'
          ? { background: 'var(--bg-3)', color: 'var(--fg-2)', border: '1px solid var(--line-strong)' }
          : { background: 'var(--bg-2)', color: 'var(--fg-3)', border: '1px solid var(--line)' };
        return (
          <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => onJump(p)}
              aria-current={isActive ? 'step' : undefined}
              className="mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                padding: '4px 12px',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 180ms var(--ease-out)',
                ...tone,
              }}
            >
              <PhaseDot status={st} active={isActive} />
              {PHASE_LABEL[p]}
            </button>
            {!isLast && (
              <span aria-hidden="true" style={{ color: 'var(--fg-4)' }}>
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
    return <span style={{ height: 6, width: 6, borderRadius: 999, background: '#fff' }} aria-hidden />;
  }
  if (status === 'completed') {
    return <span aria-hidden>✓</span>;
  }
  if (status === 'skipped') {
    return <span aria-hidden>—</span>;
  }
  return <span style={{ height: 6, width: 6, borderRadius: 999, background: 'currentColor', opacity: 0.6 }} aria-hidden />;
}
