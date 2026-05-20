'use client';

interface ApproveContinueButtonProps {
  disabled?: boolean;
  onContinue?: () => void;
}

export default function ApproveContinueButton({
  disabled = false,
  onContinue,
}: ApproveContinueButtonProps) {
  function handleClick() {
    if (disabled) return;
    onContinue?.();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Continuar a la fase de video"
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink ${
        disabled
          ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
          : 'bg-brand-pink text-white hover:bg-pink-600'
      }`}
    >
      Continuar a video
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
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
