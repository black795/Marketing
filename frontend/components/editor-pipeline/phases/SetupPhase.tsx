'use client';

import {
  ASPECT_RATIOS,
  CONTENT_TYPES,
  EDITOR_TARGETS,
  isSetupValid,
  type AspectRatio,
  type ContentType,
  type EditorTarget,
  type PipelineSetup,
} from '@/lib/editor-pipeline/types';

interface Props {
  value: PipelineSetup;
  onChange: (next: PipelineSetup) => void;
}

const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  cinematic: 'Cinematic',
  shorts: 'Shorts',
  reels: 'Reels',
  documentary: 'Documentary',
  storytelling: 'Storytelling',
  gaming: 'Gaming',
  podcast: 'Podcast clips',
};

const EDITOR_LABEL: Record<EditorTarget, string> = {
  remotion: 'Remotion',
  captions: 'Captions',
  both: 'Ambos (Remotion + Captions)',
};

const ASPECT_LABEL: Record<AspectRatio, string> = {
  '16:9': '16:9 — landscape',
  '9:16': '9:16 — vertical (Reels/Shorts/TikTok)',
  '1:1': '1:1 — cuadrado',
};

/**
 * Fase 1 — Setup. Define la metadata global del proyecto que gobierna las
 * fases siguientes: aspect ratio para previews, FPS para render, tipo de
 * contenido para defaults de duración y stylepack, editor target para mostrar
 * el panel correcto en Captions/Render.
 */
export default function SetupPhase({ value, onChange }: Props) {
  const valid = isSetupValid(value);
  return (
    <section className="space-y-6">
      {!valid && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Completá <strong>nombre del proyecto</strong>, duración y FPS para
          habilitar el resto del pipeline.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="Nombre del proyecto" required>
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Reel — De los Andes al Pacífico"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>

        <Field label="Tipo de contenido">
          <SegmentedSelect
            options={CONTENT_TYPES.map((c) => ({ value: c, label: CONTENT_TYPE_LABEL[c] }))}
            value={value.contentType}
            onChange={(v) =>
              onChange({ ...value, contentType: v as ContentType })
            }
          />
        </Field>

        <Field label="Editor de destino">
          <SegmentedSelect
            options={EDITOR_TARGETS.map((c) => ({ value: c, label: EDITOR_LABEL[c] }))}
            value={value.editorTarget}
            onChange={(v) => onChange({ ...value, editorTarget: v as EditorTarget })}
          />
        </Field>

        <Field label="Aspect ratio">
          <SegmentedSelect
            options={ASPECT_RATIOS.map((c) => ({ value: c, label: ASPECT_LABEL[c] }))}
            value={value.aspectRatio}
            onChange={(v) => onChange({ ...value, aspectRatio: v as AspectRatio })}
          />
        </Field>

        <Field label="Duración estimada (s)" required>
          <input
            type="number"
            min={1}
            max={600}
            value={value.durationSeconds}
            onChange={(e) =>
              onChange({
                ...value,
                durationSeconds: Math.max(1, Number(e.target.value) || 0),
              })
            }
            className="w-32 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </Field>

        <Field label="FPS" required>
          <SegmentedSelect
            options={[
              { value: '24', label: '24 fps · cine' },
              { value: '30', label: '30 fps · estándar' },
              { value: '60', label: '60 fps · acción' },
            ]}
            value={String(value.fps)}
            onChange={(v) =>
              onChange({ ...value, fps: Number(v) as PipelineSetup['fps'] })
            }
          />
        </Field>
      </div>

      <Field label="Estilo visual global" hint="Una línea que guíe a Storyboard y Style Engine. Ej: 'editorial, luz natural, paleta cálida, candid iPhone'.">
        <textarea
          rows={3}
          value={value.globalStyle}
          onChange={(e) => onChange({ ...value, globalStyle: e.target.value })}
          placeholder="editorial · luz natural · paleta cálida · candid iPhone"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </Field>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {label}
        {required && <span className="text-brand-pink">*</span>}
      </span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>}
    </label>
  );
}

function SegmentedSelect({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'bg-brand-pink text-white shadow-sm'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:border-brand-pink hover:text-brand-pink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
