'use client';

import { useRegenQueue } from '../queue/context';
import { TARGET_METAS } from '../types/job';

/**
 * Panel de jobs — lista colapsable de jobs con su status y acciones
 * (cancel para queued/running, retry para failed).
 */
export default function RegenQueuePanel() {
  const { state, dispatch } = useRegenQueue();
  if (state.jobs.length === 0) return null;

  const ordered = [...state.jobs].reverse(); // más recientes arriba

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
          Regeneraciones · {state.jobs.length}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLEAR_DONE' })}
          className="text-[10px] font-semibold text-[var(--fg-3)] hover:text-[var(--blue-hi)]"
        >
          Limpiar terminadas
        </button>
      </div>

      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {ordered.map((j) => {
          const meta = TARGET_METAS.find((t) => t.id === j.target)!;
          const statusInfo = STATUS_INFO[j.status];
          return (
            <li
              key={j.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${statusInfo.cls}`}
            >
              <span className="text-base leading-none">{meta.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--fg-1)]">
                  {meta.label} · escena {String(j.sceneNumber).padStart(2, '0')} · {j.sceneName}
                </p>
                <p className="truncate text-[10px] text-[var(--fg-3)]">
                  {statusInfo.label}
                  {j.attempts > 1 && ` · intento ${j.attempts}`}
                  {j.message && ` · ${j.message}`}
                  {j.error && ` · ${j.error}`}
                </p>
              </div>

              {(j.status === 'queued' || j.status === 'running') && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CANCEL', jobId: j.id })}
                  className="rounded border border-[var(--line-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
                >
                  Cancelar
                </button>
              )}
              {j.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RETRY', jobId: j.id })}
                  className="rounded border border-[rgba(245,181,68,0.35)] bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)] hover:bg-[var(--warning-soft)]"
                >
                  Reintentar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  queued: { label: '⏳ en cola', cls: 'border-[var(--line)] bg-[var(--bg-1)]' },
  running: { label: '◌ ejecutando', cls: 'border-blue-200 bg-blue-50' },
  done: { label: '✓ listo', cls: 'border-[rgba(43,212,164,0.3)] bg-[var(--success-soft)]' },
  failed: { label: '✗ falló', cls: 'border-[var(--red-ring)] bg-[var(--red-soft)]' },
  cancelled: { label: '— cancelado', cls: 'border-[var(--line)] bg-[var(--bg-3)]' },
};
