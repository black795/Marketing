'use client';

import { useId, useRef, useState } from 'react';
import {
  AVATAR_AUDIO_LIMITS,
  AVATAR_LANGUAGES,
  AVATAR_VOICES,
  SCRIPT_EXAMPLES,
  SCRIPT_SOFT_LIMIT,
  formatBytes,
} from '@/lib/avatar';
import type { AvatarVoiceMode } from '@/types/avatar';
import { dlog, dwarn } from '@/lib/debug-log';
import VoiceFieldWrapper from '@/components/voice/VoiceFieldWrapper';

/** Audio propio subido por el usuario. */
export interface AvatarAudio {
  dataUrl: string;
  name: string;
  bytes: number;
}

interface AvatarVoicePanelProps {
  voiceMode: AvatarVoiceMode;
  onVoiceModeChange: (m: AvatarVoiceMode) => void;

  voiceScript: string;
  onVoiceScriptChange: (v: string) => void;
  voice: string;
  onVoiceChange: (v: string) => void;
  voiceLanguage: string;
  onVoiceLanguageChange: (v: string) => void;
  voicePrompt: string;
  onVoicePromptChange: (v: string) => void;

  audio: AvatarAudio | null;
  onAudioChange: (a: AvatarAudio | null) => void;

  disabled?: boolean;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Panel de voz del avatar. Dos modos mutuamente excluyentes:
 *   - "tts": el avatar habla un guion sintetizado (voz + idioma + estilo).
 *   - "audio": el avatar hace lipsync de un audio que sube el usuario.
 * La API de Replicate ignora los ajustes de voz cuando hay audio, así que
 * la UI los oculta en ese modo para no confundir.
 */
export default function AvatarVoicePanel({
  voiceMode,
  onVoiceModeChange,
  voiceScript,
  onVoiceScriptChange,
  voice,
  onVoiceChange,
  voiceLanguage,
  onVoiceLanguageChange,
  voicePrompt,
  onVoicePromptChange,
  audio,
  onAudioChange,
  disabled = false,
}: AvatarVoicePanelProps) {
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const selectId = useId();
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);

  const scriptLen = voiceScript.length;
  const scriptLong = scriptLen > SCRIPT_SOFT_LIMIT;

  async function handleAudioFile(file: File) {
    setAudioError(null);
    const typeOk =
      AVATAR_AUDIO_LIMITS.supportedMimes.includes(file.type) ||
      file.type.startsWith('audio/');
    if (!typeOk) {
      setAudioError('Formato no soportado. Usa MP3, WAV, M4A, OGG o WEBM.');
      return;
    }
    if (file.size > AVATAR_AUDIO_LIMITS.maxBytes) {
      setAudioError(`El audio supera ${formatBytes(AVATAR_AUDIO_LIMITS.maxBytes)}.`);
      return;
    }
    setAudioBusy(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      onAudioChange({ dataUrl, name: file.name, bytes: file.size });
      dlog('avatar-upload', 'audio cargado', { name: file.name, bytes: file.size });
    } catch (err) {
      dwarn('avatar-upload', 'fallo al leer audio', err);
      setAudioError('No se pudo leer el archivo de audio.');
    } finally {
      setAudioBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Selector de modo de voz */}
      <div
        role="tablist"
        aria-label="Modo de voz"
        className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1"
      >
        <ModeTab
          active={voiceMode === 'tts'}
          disabled={disabled}
          onClick={() => onVoiceModeChange('tts')}
        >
          🗣️ Guion a voz
        </ModeTab>
        <ModeTab
          active={voiceMode === 'audio'}
          disabled={disabled}
          onClick={() => onVoiceModeChange('audio')}
        >
          🎵 Audio propio
        </ModeTab>
      </div>

      {voiceMode === 'tts' ? (
        <>
          {/* Guion */}
          <section>
            <header className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Guion del avatar
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  scriptLong ? 'text-amber-600' : 'text-neutral-400'
                }`}
              >
                {scriptLen} caracteres
              </span>
            </header>
            <VoiceFieldWrapper
              value={voiceScript}
              onChange={onVoiceScriptChange}
              disabled={disabled}
              fieldLabel="el guion del avatar"
            >
              <textarea
                value={voiceScript}
                onChange={(e) => onVoiceScriptChange(e.target.value)}
                disabled={disabled}
                rows={5}
                placeholder="Escribe exactamente lo que dirá el avatar…"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 pr-12 text-sm leading-relaxed text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
              />
            </VoiceFieldWrapper>
            {scriptLong && (
              <p className="mt-1 text-[11px] text-amber-600">
                Guion largo: el video será más extenso y costará más generarlo.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SCRIPT_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => onVoiceScriptChange(ex.text)}
                  disabled={disabled}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-brand-pink hover:text-brand-pink disabled:opacity-50"
                >
                  + {ex.label}
                </button>
              ))}
            </div>
          </section>

          {/* Voz + idioma */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${selectId}-voice`}
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Voz
              </label>
              <select
                id={`${selectId}-voice`}
                value={voice}
                onChange={(e) => onVoiceChange(e.target.value)}
                disabled={disabled}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
              >
                <optgroup label="Femeninas">
                  {AVATAR_VOICES.filter((v) => v.gender === 'female').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Masculinas">
                  {AVATAR_VOICES.filter((v) => v.gender === 'male').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label
                htmlFor={`${selectId}-lang`}
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Idioma / acento
              </label>
              <select
                id={`${selectId}-lang`}
                value={voiceLanguage}
                onChange={(e) => onVoiceLanguageChange(e.target.value)}
                disabled={disabled}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
              >
                {AVATAR_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estilo de habla */}
          <div>
            <label
              htmlFor={`${selectId}-vprompt`}
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Estilo de habla{' '}
              <span className="font-normal normal-case text-neutral-400">
                — tono, ritmo, emoción (no se pronuncia)
              </span>
            </label>
            <input
              id={`${selectId}-vprompt`}
              type="text"
              value={voicePrompt}
              onChange={(e) => onVoicePromptChange(e.target.value)}
              disabled={disabled}
              placeholder='Ej: "speak with calm confidence and a warm tone"'
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
            />
          </div>
        </>
      ) : (
        /* Modo audio propio */
        <section>
          <div
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (disabled) return;
              const f = e.dataTransfer.files?.[0];
              if (f) handleAudioFile(f);
            }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-6 text-center transition hover:border-brand-pink ${
              disabled ? 'opacity-60' : ''
            }`}
          >
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAudioFile(f);
                e.target.value = '';
              }}
              disabled={disabled || audioBusy}
              className="sr-only"
            />
            <span className="mb-2 text-2xl" aria-hidden="true">
              🎵
            </span>
            <p className="text-sm font-semibold text-neutral-800">
              Arrastra tu audio o{' '}
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={disabled || audioBusy}
                className="text-brand-pink underline-offset-2 hover:underline"
              >
                selecciónalo
              </button>
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">
              MP3 / WAV / M4A / OGG / WEBM · máx{' '}
              {formatBytes(AVATAR_AUDIO_LIMITS.maxBytes)}
            </p>
            {audioBusy && (
              <p className="mt-2 text-xs text-neutral-500">Cargando audio…</p>
            )}
          </div>

          {audioError && (
            <p className="mt-2 text-[11px] text-red-600">{audioError}</p>
          )}

          {audio && (
            <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-neutral-800">
                  {audio.name}
                </p>
                <button
                  type="button"
                  onClick={() => onAudioChange(null)}
                  disabled={disabled}
                  className="shrink-0 text-[11px] font-semibold text-neutral-500 hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-neutral-400">
                {formatBytes(audio.bytes)}
              </p>
              <audio
                src={audio.dataUrl}
                controls
                className="mt-2 w-full"
                preload="metadata"
              />
            </div>
          )}
          <p className="mt-2 text-[11px] text-neutral-500">
            Con audio propio, el avatar hace lipsync de tu grabación. Los
            ajustes de voz e idioma se ignoran.
          </p>
        </section>
      )}
    </div>
  );
}

function ModeTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? 'bg-white text-brand-pink shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}
