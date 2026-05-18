'use client';

// Hook React sobre Web Speech API para dictado continuo.
//
// Estados:
//   unsupported — el navegador no expone SpeechRecognition
//   denied      — el usuario rechazó el permiso del micrófono
//   idle        — listo para iniciar
//   listening   — escuchando activamente
//   paused      — pausado manualmente por el usuario
//   processing  — esperando un final result tras detenerse
//   error       — error transitorio (no fatal)
//
// El recognizer del navegador a veces se corta solo a los ~60s; el hook
// lo reinicia automáticamente mientras esté en estado `listening`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appendCleanedChunk, cleanSpokenChunk } from './cleanPrompt';

export type VoiceStatus =
  | 'unsupported'
  | 'denied'
  | 'idle'
  | 'listening'
  | 'paused'
  | 'processing'
  | 'error';

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: any) => void) | null;
  onend: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onstart: ((ev: any) => void) | null;
  onaudiostart: ((ev: any) => void) | null;
}

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseVoiceDictationOptions {
  lang?: string;
  /**
   * Lo que ya hay escrito antes de iniciar el dictado. Usado como prefijo
   * — los chunks finales se concatenan al final con limpieza.
   */
  baseText?: string;
  /** Callback cada vez que cambia el texto final acumulado. */
  onText?: (next: string) => void;
}

export interface UseVoiceDictationResult {
  status: VoiceStatus;
  errorMessage: string | null;
  finalText: string;
  interimText: string;
  /** true mientras el recognizer está corriendo o reiniciándose. */
  isActive: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Borra el texto final acumulado (no afecta al recognizer). */
  reset: (baseText?: string) => void;
}

export function useVoiceDictation(
  opts: UseVoiceDictationOptions = {}
): UseVoiceDictationResult {
  const Ctor = useMemo(() => getRecognitionCtor(), []);
  const [status, setStatus] = useState<VoiceStatus>(
    Ctor ? 'idle' : 'unsupported'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [finalText, setFinalText] = useState<string>(opts.baseText ?? '');
  const [interimText, setInterimText] = useState<string>('');

  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const wantActiveRef = useRef(false); // true → mantener corriendo (auto-restart)
  const finalTextRef = useRef(finalText);
  const onTextRef = useRef(opts.onText);
  const langRef = useRef(opts.lang ?? defaultLang());

  // Mantener refs sincronizadas.
  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);
  useEffect(() => {
    onTextRef.current = opts.onText;
  }, [opts.onText]);
  useEffect(() => {
    if (opts.lang) langRef.current = opts.lang;
  }, [opts.lang]);

  const teardown = useCallback((why: 'stop' | 'pause' | 'error' | 'end') => {
    const rec = recognizerRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onstart = null;
      try {
        if (why === 'stop' || why === 'pause' || why === 'error') {
          rec.stop();
        }
      } catch {
        /* ignore */
      }
    }
    recognizerRef.current = null;
  }, []);

  const createRecognizer = useCallback((): SpeechRecognitionLike | null => {
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setStatus('listening');
      setErrorMessage(null);
    };

    rec.onresult = (ev: any) => {
      let interim = '';
      let finalChunk = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const transcript: string = r[0]?.transcript ?? '';
        if (r.isFinal) finalChunk += transcript + ' ';
        else interim += transcript;
      }
      if (finalChunk.trim().length > 0) {
        const cleaned = cleanSpokenChunk(finalChunk);
        if (cleaned) {
          const next = appendCleanedChunk(finalTextRef.current, cleaned);
          finalTextRef.current = next;
          setFinalText(next);
          onTextRef.current?.(next);
        }
      }
      setInterimText(interim.trim());
    };

    rec.onerror = (ev: any) => {
      const err = String(ev?.error ?? 'unknown');
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        wantActiveRef.current = false;
        setStatus('denied');
        setErrorMessage('Permiso de micrófono denegado.');
        return;
      }
      if (err === 'no-speech' || err === 'aborted') {
        // recoverable — onend hará el restart si seguimos activos
        setErrorMessage(null);
        return;
      }
      if (err === 'audio-capture') {
        wantActiveRef.current = false;
        setStatus('error');
        setErrorMessage('No se detectó micrófono.');
        return;
      }
      setErrorMessage(humanizeError(err));
      setStatus('error');
    };

    rec.onend = () => {
      // Si el usuario quería seguir, reiniciamos.
      if (wantActiveRef.current) {
        try {
          rec.start();
        } catch {
          // a veces start() falla si está en transición — reintenta una vez
          setTimeout(() => {
            if (!wantActiveRef.current) return;
            try {
              rec.start();
            } catch {
              wantActiveRef.current = false;
              setStatus('idle');
            }
          }, 250);
        }
        return;
      }
      // Bajada limpia.
      setInterimText('');
      setStatus((s) =>
        s === 'paused' || s === 'denied' || s === 'error' ? s : 'idle'
      );
    };

    return rec;
  }, [Ctor]);

  const start = useCallback(() => {
    if (!Ctor) {
      setStatus('unsupported');
      return;
    }
    if (status === 'listening') return;
    setErrorMessage(null);
    const rec = createRecognizer();
    if (!rec) return;
    recognizerRef.current = rec;
    wantActiveRef.current = true;
    setStatus('processing');
    try {
      rec.start();
    } catch (err) {
      wantActiveRef.current = false;
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo iniciar el micrófono'
      );
    }
  }, [Ctor, createRecognizer, status]);

  const stop = useCallback(() => {
    wantActiveRef.current = false;
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setInterimText('');
    setStatus((s) => (s === 'denied' || s === 'unsupported' ? s : 'idle'));
  }, []);

  const pause = useCallback(() => {
    if (status !== 'listening') return;
    wantActiveRef.current = false;
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setStatus('paused');
    setInterimText('');
  }, [status]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    start();
  }, [status, start]);

  const reset = useCallback((baseText = '') => {
    finalTextRef.current = baseText;
    setFinalText(baseText);
    setInterimText('');
  }, []);

  // Limpieza al desmontar.
  useEffect(() => {
    return () => {
      wantActiveRef.current = false;
      teardown('stop');
    };
  }, [teardown]);

  const isActive = status === 'listening' || status === 'processing';

  return {
    status,
    errorMessage,
    finalText,
    interimText,
    isActive,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

function defaultLang(): string {
  if (typeof navigator === 'undefined') return 'es-ES';
  const l = navigator.language || 'es-ES';
  return l.toLowerCase().startsWith('es') ? 'es-ES' : l;
}

function humanizeError(code: string): string {
  switch (code) {
    case 'network':
      return 'El servicio de reconocimiento de voz no respondió.';
    case 'language-not-supported':
      return 'Idioma no soportado por el reconocedor.';
    case 'bad-grammar':
      return 'No se entendió la entrada de voz.';
    default:
      return `Error de reconocimiento (${code}).`;
  }
}
