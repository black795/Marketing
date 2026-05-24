'use client';

import { useEffect, useState } from 'react';
import { useStoryboard } from '@/storyboard';
import {
  listExportPresets,
  useRenderQueue,
  type BackendExportPreset,
} from '../queue';
import { LOCAL_EXPORT_PRESETS, aspectClassName } from './presets';

/**
 * Panel principal de exportación. Muestra grid de presets, control de
 * `burnCaptions` y `force`, y al hacer click encola un render con ese preset.
 *
 * Reusa `RenderQueueProvider` montado más arriba (en la página).
 */
export default function ExportPanel() {
  const { state: sb } = useStoryboard();
  const { state, enqueue, cancel, clearDone } = useRenderQueue();
  const [presets, setPresets] = useState<BackendExportPreset[]>(LOCAL_EXPORT_PRESETS);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [force, setForce] = useState(false);
  const [parallelism, setParallelism] = useState(4);

  useEffect(() => {
    listExportPresets()
      .then(setPresets)
      .catch(() => {
        /* fallback al hardcoded LOCAL_EXPORT_PRESETS — nada que hacer */
      });
  }, []);

  const projectId = sb.project.projectId;

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <section className="min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <header className="mb-3">
          <h2 className="text-sm font-bold text-neutral-900">Plataformas de export</h2>
          <p className="text-[11px] text-neutral-500">
            Cada preset re-renderiza con dimensiones, fps, crf y duración máxima
            específicos. El backend cachea segmentos por hash — re-render del
            mismo preset es casi instantáneo.
          </p>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-neutral-50 p-2.5 text-[11px]">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={burnCaptions}
              onChange={(e) => setBurnCaptions(e.target.checked)}
              className="accent-brand-pink"
            />
            Quemar captions
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="accent-brand-pink"
            />
            Forzar re-render (ignora cache)
          </label>
          <label className="flex items-center gap-1.5">
            Paralelismo
            <input
              type="number"
              min={1}
              max={8}
              value={parallelism}
              onChange={(e) => setParallelism(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
              className="w-12 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-center font-mono"
            />
          </label>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() =>
                  enqueue({
                    projectId,
                    presetId: p.id,
                    burnCaptions,
                    force,
                    parallelism,
                  })
                }
                className="flex w-full flex-col items-stretch gap-1.5 rounded-md border border-neutral-200 bg-white p-2 text-left hover:border-brand-pink"
              >
                <div
                  className={`relative ${aspectClassName(p.aspect)} w-full overflow-hidden rounded bg-neutral-900`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-3xl">
                    {p.emoji}
                  </span>
                  <span className="absolute right-1 top-1 rounded bg-black/50 px-1 py-0.5 font-mono text-[9px] text-white backdrop-blur-sm">
                    {p.aspect}
                  </span>
                </div>
                <p className="truncate text-[11px] font-bold text-neutral-800">{p.label}</p>
                <p className="text-[10px] text-neutral-500">
                  {p.width}×{p.height} · {p.fps}fps · crf {p.crf}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900">Cola de renders</h2>
          {state.jobs.length > 0 && (
            <button
              type="button"
              onClick={clearDone}
              className="text-[10px] font-semibold text-neutral-500 hover:text-brand-pink"
            >
              Limpiar terminados
            </button>
          )}
        </header>

        {state.jobs.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-400">
            Sin renders aún. Click en un preset para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...state.jobs].reverse().map((j) => (
              <li
                key={j.id}
                className="space-y-1 rounded-md border border-neutral-200 bg-white p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-neutral-800">
                    {j.presetId ?? 'nativo'}
                  </span>
                  <span className="text-[10px] text-neutral-500">{j.status}</span>
                  {(j.status === 'connecting' ||
                    j.status === 'preparing' ||
                    j.status === 'downloading' ||
                    j.status === 'building-captions' ||
                    j.status === 'encoding-segments' ||
                    j.status === 'concat' ||
                    j.status === 'final-pass') && (
                    <button
                      type="button"
                      onClick={() => cancel(j.id)}
                      className="ml-auto rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                <p className="truncate text-[10px] text-neutral-500">{j.message}</p>
                {j.progress !== null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <span
                      className="block h-full rounded-full bg-brand-pink transition-[width] duration-300"
                      style={{ width: `${Math.round((j.progress ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
                {j.outputUrl && j.status === 'done' && (
                  <div className="space-y-1 pt-1">
                    <video
                      src={j.outputUrl}
                      controls
                      playsInline
                      className="w-full rounded bg-black"
                    />
                    <div className="flex flex-wrap gap-1">
                      <a
                        href={j.outputUrl}
                        download
                        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        ⬇ Descargar
                      </a>
                      <a
                        href={j.outputUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Abrir
                      </a>
                      {typeof j.cacheHits === 'number' && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                          cache {j.cacheHits}
                        </span>
                      )}
                      {typeof j.durationSeconds === 'number' && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
                          {j.durationSeconds.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {j.error && (
                  <p className="rounded bg-red-50 px-1.5 py-1 text-[10px] text-red-700">
                    {j.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
