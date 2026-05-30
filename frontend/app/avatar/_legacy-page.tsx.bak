'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AvatarImageDropzone, {
  type AvatarImage,
} from '@/components/avatar/AvatarImageDropzone';
import AvatarVoicePanel, {
  type AvatarAudio,
} from '@/components/avatar/AvatarVoicePanel';
import AvatarSettingsPanel from '@/components/avatar/AvatarSettingsPanel';
import AvatarResultPanel from '@/components/avatar/AvatarResultPanel';
import LoadingButton from '@/components/loading/LoadingButton';
import { streamGenerateAvatar, StreamCancelledError } from '@/lib/api';
import { AVATAR_DEFAULTS, validateAvatarRequest } from '@/lib/avatar';
import { dlog, dwarn, derror } from '@/lib/debug-log';
import type {
  AvatarGenerationRequest,
  AvatarPhase,
  AvatarResolution,
  AvatarResult,
  AvatarVoiceMode,
} from '@/types/avatar';

/**
 * Avatar Studio — pantalla completa del modo "Creación de contenido por
 * Avatar". Orquesta el formulario, la llamada SSE al gateway y el estado
 * del render. El flujo de Scripts vive aparte en /scripts y no se toca.
 */
export default function AvatarStudioPage() {
  // ---- Imagen ----
  const [candidates, setCandidates] = useState<AvatarImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // ---- Voz ----
  const [voiceMode, setVoiceMode] = useState<AvatarVoiceMode>(
    AVATAR_DEFAULTS.voiceMode
  );
  const [voiceScript, setVoiceScript] = useState('');
  const [voice, setVoice] = useState(AVATAR_DEFAULTS.voice);
  const [voiceLanguage, setVoiceLanguage] = useState(
    AVATAR_DEFAULTS.voiceLanguage
  );
  const [voicePrompt, setVoicePrompt] = useState(AVATAR_DEFAULTS.voicePrompt);
  const [audio, setAudio] = useState<AvatarAudio | null>(null);

  // ---- Configuración ----
  const [resolution, setResolution] = useState<AvatarResolution>(
    AVATAR_DEFAULTS.resolution
  );
  const [videoPrompt, setVideoPrompt] = useState(AVATAR_DEFAULTS.videoPrompt);
  const [seed, setSeed] = useState('');
  const [disableSafetyFilter, setDisableSafetyFilter] = useState(
    AVATAR_DEFAULTS.disableSafetyFilter
  );
  const [disablePromptUpsampling, setDisablePromptUpsampling] = useState(
    AVATAR_DEFAULTS.disablePromptUpsampling
  );

  // ---- Estado de generación ----
  const [phase, setPhase] = useState<AvatarPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);

  const isActive =
    phase === 'connecting' ||
    phase === 'queued' ||
    phase === 'processing' ||
    phase === 'rendering';

  // Reloj en vivo del tiempo transcurrido mientras se genera.
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  // Aborta una generación en curso si el componente se desmonta.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const selectedImage = candidates.find((c) => c.id === selectedImageId) ?? null;

  function buildRequest(): AvatarGenerationRequest {
    return {
      image: selectedImage?.dataUrl ?? '',
      resolution,
      videoPrompt,
      seed: seed.trim() === '' ? null : Number(seed),
      disableSafetyFilter,
      disablePromptUpsampling,
      ...(voiceMode === 'audio' && audio
        ? { audio: audio.dataUrl }
        : {
            voiceScript,
            voice,
            voicePrompt,
            voiceLanguage,
          }),
    };
  }

  const handleGenerate = useCallback(async () => {
    if (isActive) return;

    const req = buildRequest();
    const validation = validateAvatarRequest({ ...req, voiceMode });
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      dwarn('avatar', 'validación fallida', validation.errors);
      return;
    }
    setValidationErrors([]);
    setError(null);
    setResult(null);
    setStatusMessage('Conectando con el gateway…');
    setElapsedMs(0);
    startedAtRef.current = Date.now();
    setPhase('connecting');

    const abort = new AbortController();
    abortRef.current = abort;
    dlog('avatar', 'generación iniciada', {
      mode: voiceMode,
      resolution,
      scriptLen: voiceScript.length,
    });

    try {
      const outcome = await streamGenerateAvatar(
        req,
        {
          onStart: (info) => {
            dlog('avatar', 'evento start', info);
            setPhase('queued');
            setStatusMessage('En cola en el worker…');
          },
          onStatus: ({ phase: p, message }) => {
            setPhase(p);
            if (message) setStatusMessage(message);
          },
          onWarning: (msg) => {
            dwarn('avatar', `warning del backend: ${msg}`);
            setStatusMessage(msg);
          },
        },
        abort.signal
      );

      if (outcome.status === 'completed') {
        dlog('avatar', 'generación completada', { jobId: outcome.result.jobId });
        setResult(outcome.result);
        setPhase('completed');
      } else if (outcome.status === 'failed') {
        derror('avatar', `generación fallida: ${outcome.error}`);
        setError(outcome.error);
        setPhase('failed');
      } else {
        dwarn('avatar', 'generación cancelada (outcome)');
        setPhase('cancelled');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        dwarn('avatar', 'generación cancelada por el cliente');
        setPhase('cancelled');
      } else {
        const msg =
          err instanceof Error ? err.message : 'Error inesperado al generar';
        derror('avatar', 'excepción en la generación', err);
        setError(msg);
        setPhase('failed');
      }
    } finally {
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    voiceMode,
    resolution,
    videoPrompt,
    seed,
    disableSafetyFilter,
    disablePromptUpsampling,
    selectedImage,
    voiceScript,
    voice,
    voicePrompt,
    voiceLanguage,
    audio,
  ]);

  function handleCancel() {
    dlog('avatar', 'cancelación solicitada por el usuario');
    abortRef.current?.abort();
    setStatusMessage('Cancelando…');
  }

  // Pre-chequeo barato para el estado del botón (sin mostrar errores aún).
  const canGenerate =
    !isActive &&
    !!selectedImage &&
    (voiceMode === 'tts'
      ? voiceScript.trim().length > 0
      : audio !== null);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-pink"
            >
              ← Cambiar tipo de generación
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              🎭 Creación de contenido por{' '}
              <span className="text-brand-pink">Avatar</span>
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Da vida a un retrato: el avatar habla tu guion o tu audio.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* ---- Columna izquierda: formulario ---- */}
          <div className="space-y-5">
            <SectionCard
              step={1}
              title="Imagen del avatar"
              hint="El retrato que cobrará vida."
            >
              <AvatarImageDropzone
                candidates={candidates}
                selectedId={selectedImageId}
                onChangeCandidates={setCandidates}
                onSelect={(id) => setSelectedImageId(id || null)}
                disabled={isActive}
              />
            </SectionCard>

            <SectionCard
              step={2}
              title="Voz y guion"
              hint="Qué dice el avatar y cómo lo dice."
            >
              <AvatarVoicePanel
                voiceMode={voiceMode}
                onVoiceModeChange={setVoiceMode}
                voiceScript={voiceScript}
                onVoiceScriptChange={setVoiceScript}
                voice={voice}
                onVoiceChange={setVoice}
                voiceLanguage={voiceLanguage}
                onVoiceLanguageChange={setVoiceLanguage}
                voicePrompt={voicePrompt}
                onVoicePromptChange={setVoicePrompt}
                audio={audio}
                onAudioChange={setAudio}
                disabled={isActive}
              />
            </SectionCard>

            <SectionCard
              step={3}
              title="Configuración del video"
              hint="Resolución, apariencia y ajustes avanzados."
            >
              <AvatarSettingsPanel
                resolution={resolution}
                onResolutionChange={setResolution}
                videoPrompt={videoPrompt}
                onVideoPromptChange={setVideoPrompt}
                seed={seed}
                onSeedChange={setSeed}
                disableSafetyFilter={disableSafetyFilter}
                onDisableSafetyFilterChange={setDisableSafetyFilter}
                disablePromptUpsampling={disablePromptUpsampling}
                onDisablePromptUpsamplingChange={setDisablePromptUpsampling}
                disabled={isActive}
              />
            </SectionCard>
          </div>

          {/* ---- Columna derecha: acción + resultado ---- */}
          <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <LoadingButton
                variant="primary"
                fullWidth
                onClick={handleGenerate}
                disabled={!canGenerate}
                loading={isActive}
                loadingLabel="Generando…"
              >
                Generar avatar
              </LoadingButton>

              {validationErrors.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {validationErrors.map((e) => (
                    <li key={e} className="text-xs text-red-600">
                      • {e}
                    </li>
                  ))}
                </ul>
              )}

              {!isActive && validationErrors.length === 0 && (
                <p className="mt-2 text-center text-[11px] text-neutral-400">
                  Imagen + guion o audio para empezar.
                </p>
              )}
            </div>

            <AvatarResultPanel
              phase={phase}
              statusMessage={statusMessage}
              elapsedMs={elapsedMs}
              result={result}
              error={error}
              onCancel={handleCancel}
              onRegenerate={handleGenerate}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionCard({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-sm font-bold text-white">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
