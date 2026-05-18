'use client';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export default function Spinner({
  size = 16,
  className = '',
  label,
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Cargando'}
      className={`inline-flex items-center ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-spin"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </span>
  );
}
