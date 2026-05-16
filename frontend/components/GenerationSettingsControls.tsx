'use client';

import {
  ASPECT_RATIO_OPTIONS,
  QUALITY_OPTIONS,
  SCENE_COUNT_OPTIONS,
  type AspectRatioOption,
  type GenerationSettings,
  type QualityProfile,
  type SceneCount,
} from '@/lib/generation-settings';

interface GenerationSettingsControlsProps {
  value: GenerationSettings;
  onChange: (next: GenerationSettings) => void;
  disabled?: boolean;
  /**
   * "full" — muestra etiqueta + descripción de cada sección.
   * "compact" — fila más densa, sólo chips. Útil debajo del guion aprobado.
   */
  variant?: 'full' | 'compact';
  /** Permite ocultar el control de cantidad (p.ej. después de generar el guion). */
  hideSceneCount?: boolean;
}

export default function GenerationSettingsControls({
  value,
  onChange,
  disabled = false,
  variant = 'full',
  hideSceneCount = false,
}: GenerationSettingsControlsProps) {
  function setSceneCount(n: SceneCount) {
    onChange({ ...value, sceneCount: n });
  }
  function setQuality(q: QualityProfile) {
    onChange({ ...value, quality: q });
  }
  function setAspect(a: AspectRatioOption) {
    onChange({ ...value, aspectRatio: a });
  }

  const compact = variant === 'compact';

  return (
    <div
      className={
        compact
          ? 'flex flex-wrap items-end gap-x-6 gap-y-3'
          : 'space-y-5'
      }
    >
      {!hideSceneCount && (
        <Section
          compact={compact}
          label="Cantidad de imágenes"
          help="Número de escenas que generará el guion. Cada escena → 1 imagen."
        >
          <ChipRow>
            {SCENE_COUNT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                active={value.sceneCount === opt.value}
                disabled={disabled}
                onClick={() => setSceneCount(opt.value)}
                ariaLabel={`Generar ${opt.value} escenas`}
              >
                {opt.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>
      )}

      <Section
        compact={compact}
        label="Calidad"
        help="Trade-off entre velocidad/coste y nitidez."
      >
        <ChipRow>
          {QUALITY_OPTIONS.map((opt) => {
            const active = value.quality === opt.value;
            return (
              <Chip
                key={opt.value}
                active={active}
                disabled={disabled}
                onClick={() => setQuality(opt.value)}
                ariaLabel={`Calidad ${opt.label} — ${opt.description}`}
                title={`${opt.description} (tier ${opt.resolutionTier})`}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>{opt.label}</span>
                  {!compact && (
                    <span
                      className={`text-[10px] font-normal ${
                        active ? 'text-white/85' : 'text-neutral-500'
                      }`}
                    >
                      {opt.resolutionTier}
                    </span>
                  )}
                </span>
              </Chip>
            );
          })}
        </ChipRow>
      </Section>

      <Section
        compact={compact}
        label="Aspect ratio"
        help="Formato de salida. 9:16 es ideal para Reels/TikTok."
      >
        <ChipRow>
          {ASPECT_RATIO_OPTIONS.map((opt) => {
            const active = value.aspectRatio === opt.value;
            const [w, h] = opt.ratio;
            // Mini preview: rectángulo con la proporción real
            const maxSide = 18;
            const scale = maxSide / Math.max(w, h);
            const boxW = Math.round(w * scale);
            const boxH = Math.round(h * scale);
            return (
              <Chip
                key={opt.value}
                active={active}
                disabled={disabled}
                onClick={() => setAspect(opt.value)}
                ariaLabel={`Aspect ratio ${opt.label} — ${opt.description}`}
                title={opt.description}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`inline-block rounded-sm border ${
                      active
                        ? 'border-white/80 bg-white/20'
                        : 'border-neutral-400 bg-neutral-200'
                    }`}
                    style={{ width: `${boxW}px`, height: `${boxH}px` }}
                  />
                  <span>{opt.label}</span>
                </span>
              </Chip>
            );
          })}
        </ChipRow>
      </Section>
    </div>
  );
}

function Section({
  compact,
  label,
  help,
  children,
}: {
  compact: boolean;
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  if (compact) {
    return (
      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        {children}
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-neutral-700">{label}</p>
      <p className="mb-1.5 text-xs text-neutral-500">{help}</p>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({
  active,
  disabled,
  onClick,
  ariaLabel,
  title,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-brand-pink bg-brand-pink text-white hover:bg-pink-600'
          : 'border-neutral-300 bg-white text-neutral-800 hover:border-brand-pink hover:text-brand-pink'
      }`}
    >
      {children}
    </button>
  );
}
