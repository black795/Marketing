'use client';

import type { StylePack } from '../configs/style-pack';

interface Props {
  pack: StylePack;
  active?: boolean;
  onClick?: () => void;
  /** Variant: 'card' (con descripción) o 'chip' (compacto). */
  variant?: 'card' | 'chip';
}

export default function StylePackCard({
  pack,
  active = false,
  onClick,
  variant = 'card',
}: Props) {
  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
          active
            ? 'border-brand-pink bg-brand-pink text-white shadow-sm'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-pink hover:text-brand-pink'
        }`}
        title={pack.description}
      >
        <span className="text-sm leading-none">{pack.emoji}</span>
        <span>{pack.label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition ${
        active
          ? 'border-brand-pink bg-brand-pink/5 ring-2 ring-brand-pink/20'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{pack.emoji}</span>
        <span className="text-sm font-bold text-neutral-900">{pack.label}</span>
        {active && (
          <span className="ml-auto rounded-full bg-brand-pink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            activo
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] text-neutral-500">{pack.description}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {pack.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-600"
          >
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}
