'use client';

import { useId } from 'react';
import { AVATAR_RESOLUTIONS } from '@/lib/avatar';
import type { AvatarResolution } from '@/types/avatar';

interface AvatarSettingsPanelProps {
  resolution: AvatarResolution;
  onResolutionChange: (r: AvatarResolution) => void;

  videoPrompt: string;
  onVideoPromptChange: (v: string) => void;

  /** Semilla como texto (vacío = aleatoria). El padre la parsea al enviar. */
  seed: string;
  onSeedChange: (v: string) => void;

  disableSafetyFilter: boolean;
  onDisableSafetyFilterChange: (v: boolean) => void;

  disablePromptUpsampling: boolean;
  onDisablePromptUpsamplingChange: (v: boolean) => void;

  disabled?: boolean;
}

/**
 * Configuración del video de avatar. Solo expone parámetros REALES del
 * modelo prunaai/p-video-avatar: resolución, prompt visual y los ajustes
 * avanzados (seed + dos toggles). El modelo no tiene fps, motion scale,
 * guidance ni duración — la duración la define el guion/audio.
 */
export default function AvatarSettingsPanel({
  resolution,
  onResolutionChange,
  videoPrompt,
  onVideoPromptChange,
  seed,
  onSeedChange,
  disableSafetyFilter,
  onDisableSafetyFilterChange,
  disablePromptUpsampling,
  onDisablePromptUpsamplingChange,
  disabled = false,
}: AvatarSettingsPanelProps) {
  const id = useId();

  return (
    <div className="space-y-4">
      {/* Resolución */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Resolución
        </span>
        <div className="grid grid-cols-2 gap-2">
          {AVATAR_RESOLUTIONS.map((r) => {
            const active = resolution === r;
            return (
              <button
                key={r}
                type="button"
                disabled={disabled}
                onClick={() => onResolutionChange(r)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  active
                    ? 'border-brand-pink bg-brand-pink/10 text-brand-pink'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-pink'
                }`}
              >
                {r}
                <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                  {r === '720p' ? 'más rápido' : 'más nítido'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt visual */}
      <div>
        <label
          htmlFor={`${id}-vprompt`}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Prompt visual{' '}
          <span className="font-normal normal-case text-neutral-400">
            — cómo se ve y se comporta la persona
          </span>
        </label>
        <textarea
          id={`${id}-vprompt`}
          value={videoPrompt}
          onChange={(e) => onVideoPromptChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Ej: The person is talking confidently, subtle hand gestures, soft natural light."
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
        />
      </div>

      {/* Avanzado */}
      <details className="rounded-md border border-neutral-200 bg-neutral-50/60">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-neutral-700">
          Configuración avanzada
        </summary>
        <div className="space-y-3 border-t border-neutral-200 px-3 py-3">
          <div>
            <label
              htmlFor={`${id}-seed`}
              className="mb-1 block text-xs font-semibold text-neutral-700"
            >
              Semilla{' '}
              <span className="font-normal text-neutral-400">
                — vacío = aleatoria
              </span>
            </label>
            <input
              id={`${id}-seed`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={seed}
              onChange={(e) => onSeedChange(e.target.value)}
              disabled={disabled}
              placeholder="Aleatoria"
              className="w-40 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Fija la semilla para reproducir exactamente el mismo resultado.
            </p>
          </div>

          <ToggleRow
            id={`${id}-upsampling`}
            label="Mejorar el prompt visual automáticamente"
            hint="El modelo expande el prompt visual antes de generar. Desactívalo para usar tu texto tal cual."
            // El parámetro de la API es disable_prompt_upsampling: el toggle
            // muestra la acción positiva, así que se invierte.
            checked={!disablePromptUpsampling}
            onChange={(v) => onDisablePromptUpsamplingChange(!v)}
            disabled={disabled}
          />
          <ToggleRow
            id={`${id}-safety`}
            label="Filtro de seguridad de contenido"
            hint="Revisa el prompt y la imagen antes de generar. Recomendado mantenerlo activo."
            checked={!disableSafetyFilter}
            onChange={(v) => onDisableSafetyFilterChange(!v)}
            disabled={disabled}
          />
        </div>
      </details>

      <p className="rounded-md bg-neutral-100 px-3 py-2 text-[11px] text-neutral-500">
        La duración del video la define la longitud del guion o del audio —
        este modelo no expone un control de duración, fps ni motion.
      </p>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-pink"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-xs font-semibold text-neutral-700">
          {label}
        </span>
        <span className="block text-[11px] text-neutral-400">{hint}</span>
      </label>
    </div>
  );
}
