'use client';

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { useVoiceDictation } from '@/lib/voice/useVoiceDictation';
import VoiceInputButton from './VoiceInputButton';

interface VoiceFieldWrapperProps {
  /** Texto actual del input/textarea (controlado por el padre). */
  value: string;
  /** Setter del padre — recibe el nuevo texto combinado. */
  onChange: (next: string) => void;
  /**
   * Idioma del recognizer (BCP-47). Default = navegador → es-ES si parece ES.
   */
  lang?: string;
  disabled?: boolean;
  /** Children del wrapper — debe contener el textarea/input controlado por el padre. */
  children: ReactElement;
  /** Slot opcional a la derecha del mic. */
  trailing?: ReactNode;
  /** Para tipar el aria-label del mic con contexto. */
  fieldLabel?: string;
}

/**
 * Wrapper visual + lógico que conecta un campo de texto con dictado por
 * voz. Se encarga de:
 *   - inicializar `useVoiceDictation` con el texto actual como base,
 *   - propagar los chunks finales limpiados al onChange del padre,
 *   - mostrar el botón de mic + estado en la esquina superior derecha,
 *   - mostrar el interim transcript justo debajo del campo.
 *
 * No re-renderiza al textarea — sólo envuelve. El campo sigue siendo
 * controlado por el padre.
 */
export default function VoiceFieldWrapper({
  value,
  onChange,
  lang,
  disabled = false,
  children,
  trailing,
  fieldLabel,
}: VoiceFieldWrapperProps) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const voice = useVoiceDictation({
    lang,
    baseText: value,
    onText: (next) => onChange(next),
  });

  // Si el padre cambia el texto externamente (por ejemplo "Restaurar
  // original"), resincronizamos el buffer interno del hook.
  useEffect(() => {
    if (voice.isActive) return;
    if (voice.finalText !== value) {
      voice.reset(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showInterim = voice.interimText.length > 0;
  const showErrorBanner =
    voice.status === 'error' && voice.errorMessage !== null;
  const showDeniedBanner = voice.status === 'denied';
  const showUnsupportedBanner = voice.status === 'unsupported';

  return (
    <div className="relative">
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1.5">
        {trailing}
        <VoiceInputButton
          size="sm"
          status={disabled ? 'unsupported' : voice.status}
          onStart={voice.start}
          onPause={voice.pause}
          onResume={voice.resume}
          onStop={voice.stop}
          label={
            fieldLabel
              ? `Dictar por voz para ${fieldLabel}`
              : 'Dictar por voz'
          }
        />
      </div>

      {children}

      {showInterim && (
        <p
          aria-live="polite"
          className="mt-1.5 rounded-md border border-dashed border-brand-pink/40 bg-brand-pink/5 px-3 py-1.5 text-xs italic text-neutral-600"
        >
          <span className="mr-1 font-semibold uppercase tracking-wide text-brand-pink">
            ›
          </span>
          {voice.interimText}
        </p>
      )}

      {voice.status === 'listening' && !showInterim && (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Habla con naturalidad. Di <em>“coma”</em>, <em>“punto”</em> o{' '}
          <em>“nueva línea”</em> para puntuar.
        </p>
      )}

      {showErrorBanner && (
        <p className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {voice.errorMessage}
        </p>
      )}

      {showDeniedBanner && (
        <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          Habilita el permiso de micrófono en tu navegador para usar el dictado.
        </p>
      )}

      {showUnsupportedBanner && (
        <p className="mt-1.5 text-[11px] text-neutral-400">
          Tu navegador no soporta dictado por voz (probá Chrome o Edge).
        </p>
      )}
    </div>
  );
}
