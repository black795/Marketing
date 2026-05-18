'use client';

import type { VoiceStatus } from '@/lib/voice/useVoiceDictation';

interface VoiceInputButtonProps {
  status: VoiceStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  size?: 'sm' | 'md';
  label?: string;
}

export default function VoiceInputButton({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  size = 'md',
  label,
}: VoiceInputButtonProps) {
  const cfg = describe(status);

  const handleClick = () => {
    if (status === 'idle' || status === 'error') return onStart();
    if (status === 'listening') return onPause();
    if (status === 'paused') return onResume();
    if (status === 'processing') return onStop();
  };

  const handleSecondary = () => onStop();

  const dim = size === 'sm' ? 32 : 38;
  const icon = size === 'sm' ? 14 : 16;

  const disabled = status === 'unsupported' || status === 'denied';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label ?? cfg.aria}
        aria-pressed={status === 'listening' || status === 'paused'}
        title={cfg.tooltip}
        style={{ width: dim, height: dim }}
        className={[
          'relative inline-flex items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed',
          cfg.ringClass,
          cfg.bgClass,
          cfg.textClass,
        ].join(' ')}
      >
        {cfg.glow && (
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-pink/60"
          />
        )}
        {cfg.icon === 'mic' && <MicIcon size={icon} />}
        {cfg.icon === 'mic-off' && <MicOffIcon size={icon} />}
        {cfg.icon === 'pause' && <PauseIcon size={icon} />}
        {cfg.icon === 'play' && <PlayIcon size={icon} />}
        {cfg.icon === 'spinner' && <SpinnerIcon size={icon} />}
      </button>

      {(status === 'listening' || status === 'paused') && (
        <button
          type="button"
          onClick={handleSecondary}
          aria-label="Detener dictado"
          title="Detener dictado"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}

      <VoiceStatusBadge status={status} />
    </div>
  );
}

function describe(status: VoiceStatus): {
  icon: 'mic' | 'mic-off' | 'pause' | 'play' | 'spinner';
  bgClass: string;
  textClass: string;
  ringClass: string;
  tooltip: string;
  aria: string;
  glow: boolean;
} {
  switch (status) {
    case 'listening':
      return {
        icon: 'pause',
        bgClass: 'bg-brand-pink',
        textClass: 'text-white',
        ringClass: 'border-brand-pink shadow-[0_0_0_3px_rgba(255,45,138,0.18)]',
        tooltip: 'Pausar dictado',
        aria: 'Pausar dictado, micrófono activo',
        glow: true,
      };
    case 'paused':
      return {
        icon: 'play',
        bgClass: 'bg-brand-yellow',
        textClass: 'text-neutral-900',
        ringClass: 'border-brand-yellow',
        tooltip: 'Reanudar dictado',
        aria: 'Reanudar dictado',
        glow: false,
      };
    case 'processing':
      return {
        icon: 'spinner',
        bgClass: 'bg-neutral-800',
        textClass: 'text-white',
        ringClass: 'border-neutral-800',
        tooltip: 'Iniciando micrófono…',
        aria: 'Iniciando micrófono',
        glow: false,
      };
    case 'error':
      return {
        icon: 'mic',
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        ringClass: 'border-red-300',
        tooltip: 'Error de micrófono. Reintentar.',
        aria: 'Reintentar dictado tras error',
        glow: false,
      };
    case 'denied':
      return {
        icon: 'mic-off',
        bgClass: 'bg-neutral-100',
        textClass: 'text-neutral-400',
        ringClass: 'border-neutral-200',
        tooltip: 'Permiso de micrófono denegado',
        aria: 'Permiso de micrófono denegado',
        glow: false,
      };
    case 'unsupported':
      return {
        icon: 'mic-off',
        bgClass: 'bg-neutral-100',
        textClass: 'text-neutral-400',
        ringClass: 'border-neutral-200',
        tooltip: 'Tu navegador no soporta dictado por voz',
        aria: 'Dictado por voz no soportado',
        glow: false,
      };
    case 'idle':
    default:
      return {
        icon: 'mic',
        bgClass: 'bg-white',
        textClass: 'text-neutral-700',
        ringClass: 'border-neutral-300 hover:border-brand-pink hover:text-brand-pink',
        tooltip: 'Dictar por voz',
        aria: 'Iniciar dictado por voz',
        glow: false,
      };
  }
}

function VoiceStatusBadge({ status }: { status: VoiceStatus }) {
  const text = (() => {
    switch (status) {
      case 'listening':
        return 'Escuchando…';
      case 'paused':
        return 'En pausa';
      case 'processing':
        return 'Iniciando…';
      case 'denied':
        return 'Micrófono bloqueado';
      case 'unsupported':
        return 'Sin soporte';
      case 'error':
        return 'Error';
      default:
        return null;
    }
  })();

  if (!text) return null;

  const tone = (() => {
    switch (status) {
      case 'listening':
        return 'bg-brand-pink/10 text-brand-pink';
      case 'paused':
        return 'bg-brand-yellow/40 text-neutral-800';
      case 'processing':
        return 'bg-neutral-100 text-neutral-700';
      case 'denied':
      case 'unsupported':
        return 'bg-neutral-100 text-neutral-500';
      case 'error':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-neutral-100 text-neutral-500';
    }
  })();

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status === 'listening' && (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-pink"
        />
      )}
      {text}
    </span>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function MicOffIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function PauseIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function PlayIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 5v14l12-7L7 5z" />
    </svg>
  );
}
function SpinnerIcon({ size }: { size: number }) {
  return (
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
  );
}
