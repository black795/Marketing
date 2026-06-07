'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from '@/components/loading/Spinner';
import { loadTimeline, saveTimelineCaptions } from '@/lib/captions-api';
import {
  streamRender,
  type RenderProgress,
  type RenderResult,
} from '@/lib/render-api';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_STYLES,
  type SubtitleStyleOption,
} from '@/lib/editor-pipeline/subtitle-styles';
import type { TimelineDocument } from '@/types/timeline';
import { RenderProgressPanel, RenderResultPanel } from './AutoPhase';

interface Caption {
  id: string;
  text: string;
  startSeconds: number;
  durationSeconds: number;
  style: string;
}

const newCaption = (defaults?: Partial<Caption>): Caption => ({
  id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  startSeconds: 0,
  durationSeconds: 2,
  style: DEFAULT_SUBTITLE_STYLE,
  ...defaults,
});

/**
 * Fase 4 — Subtítulos.
 *
 * Lista editable de subtítulos. Cada uno: texto + start + duración + estilo.
 * Al renderizar se guardan en timeline.captions[] y se dispara el render
 * con burnCaptions=true (libass quema los subtítulos en el final pass).
 */
export default function SubtitlesPhase({
  projectId,
  onTouched,
}: {
  projectId: string;
  onTouched: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (tl && tl.captions.length > 0) {
          const fps = tl.fps || 30;
          setCaptions(
            tl.captions.map((c) => ({
              id: c.id,
              text: c.text,
              startSeconds: Math.round((c.startFrame / fps) * 100) / 100,
              durationSeconds:
                Math.round(((c.endFrame - c.startFrame) / fps) * 100) / 100,
              style: c.style || DEFAULT_SUBTITLE_STYLE,
            })),
          );
        } else {
          setCaptions([newCaption()]);
        }
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

  const totalSeconds = useMemo(() => {
    if (!timeline) return 0;
    return timeline.durationFrames / (timeline.fps || 30);
  }, [timeline]);

  const update = (id: string, patch: Partial<Caption>) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) => setCaptions((prev) => prev.filter((c) => c.id !== id));
  const add = () =>
    setCaptions((prev) => {
      const last = prev[prev.length - 1];
      const start = last ? last.startSeconds + last.durationSeconds : 0;
      return [...prev, newCaption({ startSeconds: start })];
    });

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <Spinner size={18} className="text-[var(--blue-hi)]" />
        <span className="text-sm text-[var(--fg-2)]">Cargando proyecto…</span>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--bg-2)] p-8 text-center">
        <p className="text-sm text-[var(--fg-2)]">
          Este proyecto todavía no tiene timeline.
        </p>
        <p className="mt-1 text-xs text-[var(--fg-3)]">
          Subí clips en <strong>Inicio → Edición</strong> primero.
        </p>
        {error && <p className="mt-3 text-xs text-[var(--red-hi)]">⚠ {error}</p>}
      </div>
    );
  }

  const validCaptions = captions.filter((c) => c.text.trim().length > 0);

  const onRender = async () => {
    setRenderError(null);
    setResult(null);
    setProgress(null);

    try {
      await saveTimelineCaptions(
        projectId,
        validCaptions.map((c) => ({
          id: c.id,
          text: c.text,
          startSeconds: c.startSeconds,
          durationSeconds: c.durationSeconds,
          style: c.style,
        })),
      );
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'No se pudieron guardar las captions');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRendering(true);

    try {
      const outcome = await streamRender(
        projectId,
        { burnCaptions: true },
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

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-[var(--red-soft)] px-3 py-2 text-xs text-[var(--red-hi)]">⚠ {error}</p>
      )}

      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2 text-[11px] text-[var(--fg-3)]">
        Duración del video: <strong className="text-[var(--fg-1)]">{totalSeconds.toFixed(1)}s</strong> ·{' '}
        {timeline.fps}fps · {timeline.width}×{timeline.height}
      </div>

      <section className="space-y-3">
        {captions.map((c, idx) => (
          <CaptionRow
            key={c.id}
            index={idx + 1}
            caption={c}
            maxSeconds={totalSeconds}
            disabled={rendering}
            onChange={(patch) => update(c.id, patch)}
            onRemove={() => remove(c.id)}
          />
        ))}

        <button
          type="button"
          onClick={add}
          disabled={rendering}
          className="w-full rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--bg-2)] px-4 py-3 text-sm font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] hover:text-[var(--blue-hi)] disabled:opacity-50"
        >
          + Agregar subtítulo
        </button>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRender}
          disabled={rendering || validCaptions.length === 0}
          className="rounded-md bg-[var(--blue)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--blue-lo)] disabled:cursor-not-allowed disabled:bg-[var(--bg-4)] disabled:text-[var(--fg-4)]"
        >
          {rendering ? 'Renderizando…' : '🎬 Guardar y renderizar con subtítulos'}
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
        <span className="text-[11px] text-[var(--fg-3)]">
          {validCaptions.length} subtítulo{validCaptions.length === 1 ? '' : 's'} listo{validCaptions.length === 1 ? '' : 's'}
        </span>
      </div>

      {(rendering || progress || renderError) && (
        <RenderProgressPanel progress={progress} renderError={renderError} />
      )}

      {result && (
        <RenderResultPanel
          url={result.url}
          durationSeconds={result.durationSeconds}
          title="Render con subtítulos listo"
        />
      )}
    </div>
  );
}

// ---- Fila de un subtítulo ----

function CaptionRow({
  index,
  caption,
  maxSeconds,
  disabled,
  onChange,
  onRemove,
}: {
  index: number;
  caption: Caption;
  maxSeconds: number;
  disabled: boolean;
  onChange: (patch: Partial<Caption>) => void;
  onRemove: () => void;
}) {
  const style = SUBTITLE_STYLES.find((s) => s.id === caption.style) ?? SUBTITLE_STYLES[0];
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-3)] text-[11px] font-mono font-semibold text-[var(--fg-2)]">
          {index}
        </span>
        <div className="flex-1 space-y-3">
          <textarea
            value={caption.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Texto del subtítulo…"
            disabled={disabled}
            rows={2}
            className="w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:border-[var(--blue)] focus:outline-none disabled:opacity-60"
          />

          <div className="flex flex-wrap items-end gap-3">
            <NumberField
              label="Inicio (s)"
              value={caption.startSeconds}
              min={0}
              max={maxSeconds}
              step={0.1}
              disabled={disabled}
              onChange={(v) => onChange({ startSeconds: v })}
            />
            <NumberField
              label="Duración (s)"
              value={caption.durationSeconds}
              min={0.1}
              max={Math.max(0.1, maxSeconds)}
              step={0.1}
              disabled={disabled}
              onChange={(v) => onChange({ durationSeconds: v })}
            />
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--fg-2)]">
                Estilo
              </label>
              <select
                value={caption.style}
                onChange={(e) => onChange({ style: e.target.value })}
                disabled={disabled}
                className="mt-1 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-1)] px-2 py-1.5 text-sm text-[var(--fg-1)] focus:border-[var(--blue)] focus:outline-none disabled:opacity-60"
              >
                {SUBTITLE_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="rounded-md border border-[var(--line)] bg-[var(--bg-3)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fg-3)] hover:border-[var(--red)] hover:text-[var(--red-hi)] disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>

          <StylePreview style={style} text={caption.text || style.preview.sample} />
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--fg-2)]">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="mt-1 w-24 rounded-md border border-[var(--line-strong)] bg-[var(--bg-1)] px-2 py-1.5 text-sm font-mono text-[var(--fg-1)] focus:border-[var(--blue)] focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}

function StylePreview({ style, text }: { style: SubtitleStyleOption; text: string }) {
  const p = style.preview;
  return (
    <div className="rounded-md border border-[var(--line)] bg-black px-3 py-4">
      <div className="flex items-center justify-center">
        <span
          style={{
            background: p.bg,
            color: p.fg,
            fontFamily: p.fontFamily,
            fontWeight: p.fontWeight,
            textTransform: p.textTransform ?? 'none',
            padding: p.bg === 'transparent' ? 0 : '4px 10px',
            borderRadius: 4,
            fontSize: 22,
            lineHeight: 1.1,
            textShadow: p.border
              ? `-2px -2px 0 ${p.border}, 2px -2px 0 ${p.border}, -2px 2px 0 ${p.border}, 2px 2px 0 ${p.border}`
              : 'none',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          {text}
        </span>
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--fg-3)]">
        {style.label} — {style.description}
      </p>
    </div>
  );
}
