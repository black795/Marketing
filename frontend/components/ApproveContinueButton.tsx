'use client';

import { useState } from 'react';

interface ApproveContinueButtonProps {
  disabled?: boolean;
  onApprove?: () => void;
}

export default function ApproveContinueButton({
  disabled = false,
  onApprove,
}: ApproveContinueButtonProps) {
  const [approved, setApproved] = useState(false);

  function handleClick() {
    if (disabled || approved) return;
    setApproved(true);
    onApprove?.();
  }

  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || approved}
        aria-label={
          approved
            ? 'Imágenes aprobadas — fase de video próximamente'
            : 'Aprobar imágenes y continuar a la fase de video'
        }
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink ${
          approved
            ? 'cursor-default bg-emerald-600 text-white'
            : disabled
            ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
            : 'bg-brand-pink text-white hover:bg-pink-600'
        }`}
      >
        {approved ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Aprobado — video próximamente
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Aprobar y continuar a video
          </>
        )}
      </button>
      {approved && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-64 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          Marcaste las imágenes como aprobadas. La generación de video se habilitará en la próxima fase.
        </span>
      )}
    </span>
  );
}
