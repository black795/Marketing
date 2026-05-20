'use client';

import { useEffect } from 'react';
import LoadingButton from './loading/LoadingButton';
import { estimateVideoCost, formatUsd } from '@/lib/video-pricing';
import type { VideoModel } from '@/types/story';

interface CostConfirmDialogProps {
  open: boolean;
  model: VideoModel;
  duration: number;
  resolution: string;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CostConfirmDialog({
  open,
  model,
  duration,
  resolution,
  count,
  onConfirm,
  onCancel,
}: CostConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const cost = estimateVideoCost({ model, duration, count });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cost-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cost-confirm-title" className="text-lg font-bold text-neutral-900">
          Confirmá la generación
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Vas a generar <strong>{count}</strong> video{count === 1 ? '' : 's'} de{' '}
          <strong>{duration}s</strong> cada uno con el modelo{' '}
          <strong>{model}</strong> a {resolution}.
        </p>

        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              Costo estimado
            </span>
            <span className="text-2xl font-bold text-brand-pink">
              ≈ {formatUsd(cost.totalUsd)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            {formatUsd(cost.perVideoUsd)} por video · {formatUsd(cost.perSecondUsd)}/segundo
          </p>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          Precios orientativos del momento de implementación. Pueden cambiar sin
          aviso — verificá en{' '}
          <a
            href="https://replicate.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-pink underline"
          >
            replicate.com/pricing
          </a>
          . Las escenas en vuelo no se pueden cancelar, sólo las pendientes.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
          >
            Cancelar
          </button>
          <LoadingButton variant="primary" onClick={onConfirm}>
            Sí, generar
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
