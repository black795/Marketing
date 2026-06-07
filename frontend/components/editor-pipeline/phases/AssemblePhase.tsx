'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from '@/components/loading/Spinner';
import { loadTimeline } from '@/lib/captions-api';
import { getEditPlan, saveEditPlan } from '@/lib/edit-plan-api';
import {
  streamRender,
  type RenderProgress,
  type RenderResult,
} from '@/lib/render-api';
import type { TimelineDocument } from '@/types/timeline';
import { RenderProgressPanel, RenderResultPanel } from './AutoPhase';

/**
 * Fase 3 — Junte de clips.
 *
 * Lista las escenas del proyecto, deja al usuario escribir el orden deseado
 * (ej. "2, 1, 3" o "3, 1" para usar solo esas) y dispara el render con
 * Remotion. El orden se guarda en el edit-plan y el backend lo aplica.
 */
export default function AssemblePhase({
  projectId,
  onTouched,
}: {
  projectId: string;
  onTouched: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderText, setOrderText] = useState('');
  const [prompt, setPrompt] = useState('');

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- Carga inicial: timeline + edit-plan ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadTimeline(projectId).catch(() => null),
      getEditPlan(projectId).catch(() => null),
    ])
      .then(([tl, planRes]) => {
        if (cancelled) return;
        setTimeline(tl);
        if (planRes?.plan) {
          if (planRes.plan.sceneOrder.length > 0) {
            setOrderText(planRes.plan.sceneOrder.join(', '));
          }
          if (planRes.plan.prompt) setPrompt(planRes.plan.prompt);
        }
        onTouched();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando proyecto');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ---- Escenas disponibles (deduplicadas) ----
  const scenes = useMemo(() => {
    const clips = timeline?.clips ?? [];
    const seen = new Map<number, { sceneNumber: number; kind: string; src?: string }>();
    for (const c of clips) {
      if (!seen.has(c.sceneNumber)) {
        seen.set(c.sceneNumber, {
          sceneNumber: c.sceneNumber,
          kind: c.kind,
          src: c.src ?? undefined,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
  }, [timeline]);

  // ---- Parser del orden ----
  const parsed = useMemo(() => parseOrder(orderText, scenes.map((s) => s.sceneNumber)), [
    orderText,
    scenes,
  ]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <Spinner size={18} className="text-[var(--blue-hi)]" />
        <span className="text-sm text-[var(--fg-2)]">Cargando proyecto…</span>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--bg-2)] p-8 text-center">
        <p className="text-sm text-[var(--fg-2)]">
          No hay escenas para juntar todavía.
        </p>
        <p className="mt-1 text-xs text-[var(--fg-3)]">
          Subí clips en <strong>Inicio → Edición</strong> primero.
        </p>
        {error && <p className="mt-3 text-xs text-[var(--red-hi)]">⚠ {error}</p>}
      </div>
    );
  }

  // ---- Acción principal: guardar edit-plan + render ----
  const onRender = async () => {
    setRenderError(null);
    setResult(null);
    setProgress(null);

    try {
      await saveEditPlan(projectId, {
        sceneOrder: parsed.order,
        includedScenes: parsed.included,
        prompt,
      });
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'No se pudo guardar el orden');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRendering(true);

    try {
      const outcome = await streamRender(
        projectId,
        { burnCaptions: false },
        {
          onProgress: (p) => setProgress(p),
        },
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

  const onCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-[var(--red-soft)] px-3 py-2 text-xs text-[var(--red-hi)]">⚠ {error}</p>
      )}

      {/* Lista de escenas disponibles */}
      <section>
        <header className="mb-2 flex items-center gap-2">
          <span className="text-base" aria-hidden>🎬</span>
          <h3 className="text-sm font-semibold text-[var(--fg-1)]">
            Escenas disponibles ({scenes.length})
          </h3>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {scenes.map((s) => (
            <div
              key={s.sceneNumber}
              className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg-2)]"
            >
              <div className="relative aspect-video w-full bg-black">
                {s.src && s.kind === 'video' ? (
                  <video
                    src={s.src}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      try {
                        v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
                      } catch {}
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : s.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.src} alt={`Escena ${s.sceneNumber}`} className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  #{s.sceneNumber}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--fg-3)]">
          Usá estos números abajo para indicar el orden del junte.
        </p>
      </section>

      {/* Editor de orden + prompt */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
        <label className="block text-sm font-semibold text-[var(--fg-1)]">
          Orden de las escenas
        </label>
        <p className="mt-0.5 text-[11px] text-[var(--fg-3)]">
          Lista de números separados por coma. Si omitís alguno, no se incluye.
          Ejemplos: <code className="rounded bg-[var(--bg-3)] px-1">2, 1, 3</code> o
          <code className="ml-1 rounded bg-[var(--bg-3)] px-1">3, 1</code>.
        </p>
        <input
          type="text"
          value={orderText}
          onChange={(e) => setOrderText(e.target.value)}
          placeholder={scenes.map((s) => s.sceneNumber).join(', ')}
          disabled={rendering}
          className="mt-2 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-1)] px-3 py-2 font-mono text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:border-[var(--blue)] focus:outline-none disabled:opacity-60"
        />
        <ParsePreview parsed={parsed} allScenes={scenes.map((s) => s.sceneNumber)} />

        <label className="mt-4 block text-sm font-semibold text-[var(--fg-1)]">
          Instrucciones extra (opcional)
        </label>
        <p className="mt-0.5 text-[11px] text-[var(--fg-3)]">
          Texto libre que se guarda en el edit-plan junto al orden.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: junte directo, sin transiciones, ritmo rápido…"
          disabled={rendering}
          rows={3}
          className="mt-2 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:border-[var(--blue)] focus:outline-none disabled:opacity-60"
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onRender}
            disabled={rendering || parsed.included.length === 0}
            className="rounded-md bg-[var(--blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--blue-lo)] disabled:cursor-not-allowed disabled:bg-[var(--bg-4)] disabled:text-[var(--fg-4)]"
          >
            {rendering ? 'Renderizando…' : '🎞️ Juntar y renderizar'}
          </button>
          {rendering && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-3)] px-3 py-2 text-sm font-semibold text-[var(--fg-2)] hover:border-[var(--red)] hover:text-[var(--red-hi)]"
            >
              Cancelar
            </button>
          )}
        </div>
      </section>

      {/* Progreso */}
      {(rendering || progress || renderError) && (
        <RenderProgressPanel progress={progress} renderError={renderError} />
      )}

      {/* Resultado */}
      {result && (
        <RenderResultPanel
          url={result.url}
          durationSeconds={result.durationSeconds}
          title={`Render listo · ${result.clipCount} clips`}
        />
      )}
    </div>
  );
}

// ---- Helpers ----

interface ParsedOrder {
  /** sceneNumbers en el orden ingresado (incluye duplicados eliminados). */
  order: number[];
  /** sceneNumbers válidos a incluir. */
  included: number[];
  /** Números que aparecieron pero no existen. */
  invalid: number[];
  /** Si quedaron escenas existentes que el usuario no incluyó. */
  omitted: number[];
}

function parseOrder(text: string, available: number[]): ParsedOrder {
  const availSet = new Set(available);
  const seen = new Set<number>();
  const invalid: number[] = [];
  const ordered: number[] = [];

  text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((t) => {
      const n = Number(t);
      if (!Number.isFinite(n) || !Number.isInteger(n)) return;
      if (!availSet.has(n)) {
        if (!invalid.includes(n)) invalid.push(n);
        return;
      }
      if (!seen.has(n)) {
        seen.add(n);
        ordered.push(n);
      }
    });

  // Si el textarea está vacío, asumimos "todas en orden natural"
  const effective = ordered.length === 0 ? available.slice() : ordered;
  const omitted = available.filter((n) => !new Set(effective).has(n));

  return {
    order: effective,
    included: effective,
    invalid,
    omitted,
  };
}

function ParsePreview({ parsed, allScenes }: { parsed: ParsedOrder; allScenes: number[] }) {
  const isAll = parsed.included.length === allScenes.length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-[var(--fg-3)]">Resultado:</span>
      {parsed.included.length === 0 ? (
        <span className="rounded bg-[var(--red-soft)] px-1.5 py-0.5 font-semibold text-[var(--red-hi)]">
          sin escenas válidas
        </span>
      ) : (
        parsed.included.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="rounded bg-[var(--blue-soft)] px-1.5 py-0.5 font-mono font-semibold text-[var(--blue-hi)]"
          >
            #{n}
          </span>
        ))
      )}
      {!isAll && parsed.omitted.length > 0 && (
        <span className="ml-2 text-[var(--fg-4)]">
          omitidas: {parsed.omitted.map((n) => `#${n}`).join(', ')}
        </span>
      )}
      {parsed.invalid.length > 0 && (
        <span className="ml-2 rounded bg-[var(--warning-soft)] px-1.5 py-0.5 font-semibold text-[var(--warning)]">
          inexistentes: {parsed.invalid.join(', ')}
        </span>
      )}
    </div>
  );
}
