'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from '@/components/loading/Spinner';
import { loadTimeline, saveTimelineCaptions } from '@/lib/captions-api';
import { saveEditPlan } from '@/lib/edit-plan-api';
import {
  streamRender,
  type RenderProgress,
  type RenderResult,
} from '@/lib/render-api';
import { getAutoPlan, type AutoPlan } from '@/lib/auto-api';
import { SUBTITLE_STYLES } from '@/lib/editor-pipeline/subtitle-styles';
import type { TimelineDocument } from '@/types/timeline';

/**
 * Fase 0 — Auto (IA).
 *
 * Prompt único: el LLM arma el junte y los subtítulos. El usuario revisa el
 * plan y confirma para guardar y renderizar.
 */
export default function AutoPhase({
  projectId,
  onTouched,
}: {
  projectId: string;
  onTouched: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AutoPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTimeline(projectId)
      .then((tl) => {
        if (cancelled) return;
        setTimeline(tl);
        onTouched();
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando timeline');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const scenes = useMemo(() => {
    if (!timeline) return [];
    const seen = new Set<number>();
    const out: Array<{ sceneNumber: number; durationSeconds: number }> = [];
    for (const c of timeline.clips) {
      if (seen.has(c.sceneNumber)) continue;
      seen.add(c.sceneNumber);
      out.push({
        sceneNumber: c.sceneNumber,
        durationSeconds: Math.round((c.durationFrames / timeline.fps) * 100) / 100,
      });
    }
    return out;
  }, [timeline]);

  const onGenerate = async () => {
    setPlanError(null);
    setPlan(null);
    setResult(null);
    setProgress(null);
    setPlanning(true);
    try {
      const p = await getAutoPlan(projectId, prompt.trim());
      setPlan(p);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'No se pudo generar el plan');
    } finally {
      setPlanning(false);
    }
  };

  const onConfirmAndRender = async () => {
    if (!plan) return;
    setRenderError(null);
    setResult(null);
    setProgress(null);

    try {
      await saveEditPlan(projectId, {
        sceneOrder: plan.sceneOrder,
        includedScenes: plan.sceneOrder,
        prompt,
      });
      await saveTimelineCaptions(
        projectId,
        plan.captions.map((c, i) => ({
          id: `caption-auto-${i + 1}`,
          text: c.text,
          startSeconds: c.startSeconds,
          durationSeconds: c.durationSeconds,
          style: c.style,
        })),
      );
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Error guardando el plan');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRendering(true);
    try {
      const outcome = await streamRender(
        projectId,
        { burnCaptions: plan.captions.length > 0 },
        { onProgress: (p) => setProgress(p) },
        ctrl.signal,
      );
      if (outcome.status === 'done') {
        setResult(outcome.render);
        setProgress({ phase: 'done', message: 'Render completo', progress: 1 });
      } else if (outcome.status === 'cancelled') {
        setRenderError('Render cancelado');
      } else {
        setRenderError(outcome.error);
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Error en el render');
    } finally {
      setRendering(false);
      abortRef.current = null;
    }
  };

  const onCancel = () => abortRef.current?.abort();

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <Spinner size={18} className="text-brand-pink" />
        <span className="text-sm text-neutral-600">Cargando proyecto…</span>
      </div>
    );
  }

  if (!timeline || scenes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-600">
          Este proyecto todavía no tiene clips.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Subí videos en <strong>Inicio → Edición</strong> primero, después volvé a esta fase.
        </p>
        {error && <p className="mt-3 text-xs text-red-600">⚠ {error}</p>}
      </div>
    );
  }

  const totalRawSec = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</p>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-500">
          <span>
            {scenes.length} escenas · {totalRawSec.toFixed(1)}s totales · {timeline.fps}fps
          </span>
          <span>{timeline.width}×{timeline.height}</span>
        </div>
        <label className="block text-sm font-semibold text-neutral-900">
          ¿Qué video querés?
        </label>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Frase libre. La IA elige el orden, los subtítulos y el estilo.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={planning || rendering}
          rows={3}
          placeholder="Ej: Reel para TikTok promocionando mi cafetería. Tono casual, subtítulos amarillos."
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-pink focus:outline-none disabled:opacity-60"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={planning || rendering || prompt.trim().length === 0}
            className="rounded-md bg-brand-pink px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {planning ? 'Pensando…' : '✨ Generar plan con IA'}
          </button>
          {planError && (
            <span className="text-xs text-red-600">⚠ {planError}</span>
          )}
        </div>
      </section>

      {plan && <PlanPreview plan={plan} onChange={setPlan} disabled={rendering} />}

      {plan && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirmAndRender}
            disabled={rendering || plan.sceneOrder.length === 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {rendering ? 'Renderizando…' : '🎬 Confirmar y renderizar'}
          </button>
          {rendering && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-red-400 hover:text-red-600"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {(rendering || progress || renderError) && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Progreso del render</h3>
          {renderError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {renderError}</p>
          )}
          {progress && !renderError && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span className="font-mono uppercase tracking-wide text-neutral-500">
                  {progress.phase}
                </span>
                {typeof progress.progress === 'number' && (
                  <span className="font-semibold text-neutral-700">
                    {Math.round(progress.progress * 100)}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-700">{progress.message}</p>
              {typeof progress.progress === 'number' && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full bg-brand-pink transition-all"
                    style={{ width: `${Math.round(progress.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-emerald-900">
            ✅ Render listo · {Math.round(result.durationSeconds * 10) / 10}s
          </h3>
          <video src={result.url} controls className="w-full max-w-md rounded-md bg-black" />
          <a
            href={result.url}
            download
            className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
          >
            ⬇ Descargar mp4
          </a>
        </section>
      )}
    </div>
  );
}

// ---- Preview del plan generado ----

function PlanPreview({
  plan,
  onChange,
  disabled,
}: {
  plan: AutoPlan;
  onChange: (next: AutoPlan) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
      <header>
        <h3 className="text-sm font-semibold text-violet-900">📋 Plan propuesto</h3>
        {plan.reasoning && (
          <p className="mt-1 text-xs italic text-violet-700">"{plan.reasoning}"</p>
        )}
      </header>

      <div>
        <p className="text-[11px] font-semibold text-neutral-700">Orden de escenas</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {plan.sceneOrder.length === 0 ? (
            <span className="text-xs text-red-600">⚠ La IA no propuso ninguna escena</span>
          ) : (
            plan.sceneOrder.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="rounded bg-violet-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-900"
              >
                #{n}
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-neutral-700">
          Subtítulos ({plan.captions.length})
        </p>
        {plan.captions.length === 0 ? (
          <p className="mt-1 text-xs italic text-neutral-500">Sin subtítulos.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {plan.captions.map((c, i) => {
              const style = SUBTITLE_STYLES.find((s) => s.id === c.style);
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-violet-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="mt-0.5 font-mono text-violet-600">
                    {c.startSeconds.toFixed(1)}s
                  </span>
                  <span className="text-neutral-400">·</span>
                  <span className="font-mono text-violet-600">{c.durationSeconds.toFixed(1)}s</span>
                  <span className="text-neutral-400">·</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {style?.label ?? c.style}
                  </span>
                  <input
                    value={c.text}
                    onChange={(e) => {
                      const next = { ...plan, captions: plan.captions.slice() };
                      next.captions[i] = { ...c, text: e.target.value };
                      onChange(next);
                    }}
                    disabled={disabled}
                    className="flex-1 rounded border border-transparent bg-transparent px-1 text-neutral-800 hover:border-neutral-200 focus:border-brand-pink focus:outline-none"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-neutral-500">
        Podés editar el texto de cada subtítulo antes de confirmar. Para
        cambios más finos (orden, timing, estilo) usá las fases siguientes.
      </p>
    </section>
  );
}
