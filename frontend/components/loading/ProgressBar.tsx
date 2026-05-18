'use client';

interface ProgressBarProps {
  /** Valor entre 0 y 1. Si es null/undefined → modo indeterminado. */
  value?: number | null;
  label?: string;
  detail?: string;
  showPercent?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  label,
  detail,
  showPercent = true,
  className = '',
}: ProgressBarProps) {
  const indeterminate = value === null || value === undefined;
  const pct = indeterminate
    ? null
    : Math.max(0, Math.min(1, value)) * 100;

  return (
    <div className={className}>
      {(label || (showPercent && pct !== null)) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          {label && (
            <span className="font-semibold text-neutral-700">{label}</span>
          )}
          {showPercent && pct !== null && (
            <span className="font-mono text-neutral-500">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-label={label ?? 'Progreso'}
        className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        {indeterminate ? (
          <span className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-brand-pink" />
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-brand-pink transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {detail && (
        <p className="mt-1.5 text-[11px] text-neutral-500">{detail}</p>
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(120%);
          }
          100% {
            transform: translateX(280%);
          }
        }
      `}</style>
    </div>
  );
}
