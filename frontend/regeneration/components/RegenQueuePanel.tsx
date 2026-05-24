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
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Regeneraciones · {state.jobs.length}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLEAR_DONE' })}
          className="text-[10px] font-semibold text-neutral-500 hover:text-brand-pink"
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
                <p className="truncate font-semibold text-neutral-800">
                  {meta.label} · escena {String(j.sceneNumber).padStart(2, '0')} · {j.sceneName}
                </p>
                <p className="truncate text-[10px] text-neutral-500">
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
                  className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
              )}
              {j.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RETRY', jobId: j.id })}
                  className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
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
  queued: { label: '⏳ en cola', cls: 'border-neutral-200 bg-neutral-50' },
  running: { label: '◌ ejecutando', cls: 'border-blue-200 bg-blue-50' },
  done: { label: '✓ listo', cls: 'border-emerald-200 bg-emerald-50' },
  failed: { label: '✗ falló', cls: 'border-red-200 bg-red-50' },
  cancelled: { label: '— cancelado', cls: 'border-neutral-200 bg-neutral-100' },
};
