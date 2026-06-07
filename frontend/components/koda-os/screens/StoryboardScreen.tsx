'use client';

// Fase 04 - Generacion de video (image-to-video con Kling v3 / v3-omni).
//
// Toma las escenas con imagen ya generada, deja al usuario:
//   - elegir el modelo (kling-v3 / kling-v3-omni)
//   - duracion (3/5/10s), resolucion (720p/1080p), sonido nativo on/off
//   - escribir un video_prompt por escena (movimiento de camara/accion)
//   - seleccionar cuales generar/regenerar
// Y abre un stream SSE que llena cada card con el video URL conforme Replicate
// los va devolviendo. Cancel mata el stream. Continuar pasa a /carousel.
//
// Port del legacy VideoReviewPanel + handleStartVideoGeneration al Koda OS.

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconComponent } from '../icons';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  Spinner,
} from '../primitives';
import { projectStore, useProject } from '../project-store';
import SaveFavoriteButton from '../SaveFavoriteButton';
import {
  streamGenerateVideosFromScenes,
  StreamCancelledError,
} from '@/lib/api';
import type {
  Scene,
  VideoModel,
  VideoSceneOutput,
} from '@/types/story';

type VideoStreamStatus = 'pending' | 'active' | 'done' | 'error';

type Progress = {
  total: number;
  completed: number;
  message: string;
};

const KLING_DURATIONS = [3, 5, 10] as const;
type KlingDuration = (typeof KLING_DURATIONS)[number];
const RESOLUTION_OPTIONS: Array<'720p' | '1080p'> = ['720p', '1080p'];

/**
 * Snappea la duración natural del guion (1.5s, 2.5s, 4s, …) a la grilla
 * que Kling realmente soporta. Buscamos el valor más cercano; el render
 * va a ser un poquito más largo pero el trim final se hace en el timeline.
 */
function snapKlingDuration(seconds: number | undefined): KlingDuration {
  if (!Number.isFinite(seconds) || (seconds as number) <= 0) return 5;
  const s = seconds as number;
  let best: KlingDuration = KLING_DURATIONS[0];
  let bestDelta = Math.abs(s - best);
  for (const opt of KLING_DURATIONS) {
    const d = Math.abs(s - opt);
    if (d < bestDelta) {
      best = opt;
      bestDelta = d;
    }
  }
  return best;
}

export default function StoryboardScreen() {
  const router = useRouter();
  const { script, scenes, videoScenes, form } = useProject();

  // ---------- Setup config ----------
  const hasReferenceImages = form.references.length > 0;

  const [model, setModel] = useState<VideoModel>(
    hasReferenceImages ? 'kling-v3-omni' : 'kling-v3',
  );
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [sound, setSound] = useState<boolean>(true);

  // ---------- Per-scene state ----------
  const eligibleScenes = useMemo(
    () =>
      (scenes ?? []).filter((s): s is Scene & { image_url: string } => !!s.image_url),
    [scenes],
  );

  const previousByScene = useMemo(() => {
    const m = new Map<number, VideoSceneOutput>();
    for (const p of videoScenes ?? []) m.set(p.scene_number, p);
    return m;
  }, [videoScenes]);

  // Duración por escena: se snapea al valor de Kling más cercano (3/5/10s)
  // partiendo del valor del guion. El usuario confirma cada uno mirando el
  // badge en la esquina inferior derecha de la card.
  const durationByScene = useMemo(() => {
    const m = new Map<number, KlingDuration>();
    for (const s of eligibleScenes) m.set(s.scene_number, snapKlingDuration(s.duration));
    return m;
  }, [eligibleScenes]);

  const [promptsByScene, setPromptsByScene] = useState<Map<number, string>>(
    () => initialPrompts(eligibleScenes, previousByScene),
  );

  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(
    () => initialSelection(eligibleScenes, previousByScene),
  );

  // Si las escenas cambian (entrada nueva), re-seedea prompts y seleccion.
  const lastSig = useRef<string>('');
  useEffect(() => {
    const sig = eligibleScenes
      .map((s) => `${s.scene_number}:${s.image_url}`)
      .join('|');
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    setPromptsByScene(initialPrompts(eligibleScenes, previousByScene));
    setSelectedScenes(initialSelection(eligibleScenes, previousByScene));
  }, [eligibleScenes, previousByScene]);

  // ---------- Stream state ----------
  const [statusByNumber, setStatusByNumber] = useState<Map<number, VideoStreamStatus>>(
    () => new Map(),
  );
  const [progress, setProgress] = useState<Progress | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);

  // ---------- Guard ----------
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  // ---------- Helpers ----------
  function setPrompt(sceneNumber: number, value: string) {
    setPromptsByScene((prev) => {
      const next = new Map(prev);
      next.set(sceneNumber, value);
      return next;
    });
    // Si el prompt cambia y habia resultado previo, marcar la escena (asume regen).
    const prev = previousByScene.get(sceneNumber);
    if (prev && value.trim() !== (prev.video_prompt ?? '').trim()) {
      setSelectedScenes((curr) => {
        if (curr.has(sceneNumber)) return curr;
        const next = new Set(curr);
        next.add(sceneNumber);
        return next;
      });
    }
  }

  function toggleSelected(sceneNumber: number) {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneNumber)) next.delete(sceneNumber);
      else next.add(sceneNumber);
      return next;
    });
  }

  const includedScenes = eligibleScenes.filter((s) =>
    selectedScenes.has(s.scene_number),
  );
  const allHavePrompts = includedScenes.every((s) => {
    const p = promptsByScene.get(s.scene_number) ?? '';
    return p.trim().length > 0;
  });
  const isStreaming = !!progress;
  const canSubmit =
    includedScenes.length > 0 && allHavePrompts && !isStreaming;

  const done = (videoScenes ?? []).filter(
    (v) => v.video_url && !v.video_error,
  ).length;
  const allDone = done > 0 && done >= eligibleScenes.length;

  // ---------- Stream ----------
  async function startStream() {
    if (!canSubmit || !script) return;
    setStreamError(null);
    setWarning(null);
    userCancelledRef.current = false;

    const targets = includedScenes.map((s) => ({
      scene_number: s.scene_number,
      image_url: s.image_url,
      video_prompt: (promptsByScene.get(s.scene_number) ?? '').trim(),
      duration: durationByScene.get(s.scene_number) ?? 5,
    }));
    // top-level duration es el fallback que usa el backend si una escena
    // viene sin el campo. Tomamos el máximo del lote para no recortar nada.
    const fallbackDuration = targets.reduce(
      (max, t) => Math.max(max, t.duration),
      5,
    );

    const initialStatus = new Map<number, VideoStreamStatus>(statusByNumber);
    for (const t of targets) initialStatus.set(t.scene_number, 'pending');
    setStatusByNumber(initialStatus);

    setProgress({
      total: targets.length,
      completed: 0,
      message: 'Conectando con el worker...',
    });

    const abort = new AbortController();
    streamAbortRef.current = abort;
    const refUrls = form.references.map((r) => r.dataUrl);

    console.log('[video] POST → /api/generate-videos-from-scenes', {
      model,
      fallbackDuration,
      perSceneDurations: targets.map((t) => `${t.scene_number}=${t.duration}s`),
      resolution,
      sound,
      scenes: targets.length,
    });

    try {
      const outcome = await streamGenerateVideosFromScenes(
        {
          model,
          projectId: script.projectId,
          duration: fallbackDuration,
          resolution,
          sound,
          aspectRatio: form.settings.aspectRatio,
          scenes: targets,
          referenceImageUrls: refUrls.length > 0 ? refUrls : undefined,
        },
        {
          onStart: ({ total }) => {
            console.log('[video] SSE start', { total });
            setProgress({
              total,
              completed: 0,
              message: 'Encolando videos...',
            });
          },
          onSceneStart: ({ scene_number, index, total }) => {
            console.log('[video] SSE scene-start', { scene_number, index, total });
            setStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(scene_number, 'active');
              return next;
            });
            setProgress({
              total,
              completed: index,
              message: `Renderizando escena ${scene_number} (1-3 min)...`,
            });
          },
          onScene: ({ scene, index, total }) => {
            console.log('[video] SSE scene-done', {
              scene_number: scene.scene_number,
              hasVideo: !!scene.video_url,
              hasError: !!scene.video_error,
              index,
              total,
            });
            // Merge en projectStore.videoScenes
            const current = projectStore.get().videoScenes ?? [];
            const idx = current.findIndex(
              (v) => v.scene_number === scene.scene_number,
            );
            const next = idx < 0
              ? [...current, scene]
              : current.map((v, i) => (i === idx ? scene : v));
            projectStore.setVideoScenes(next);
            setStatusByNumber((prev) => {
              const m = new Map(prev);
              m.set(scene.scene_number, scene.video_url ? 'done' : 'error');
              return m;
            });
            setProgress({
              total,
              completed: index,
              message:
                index === total
                  ? 'Finalizando...'
                  : `Escena ${scene.scene_number} lista (${index}/${total})`,
            });
          },
          onWarning: (msg) => {
            console.warn('[video] SSE warning', msg);
            setWarning(msg);
          },
        },
        abort.signal,
      );
      console.log('[video] OUTCOME', outcome.status, {
        scenes: outcome.scenes.length,
        failed: outcome.failed,
      });
      if (outcome.status === 'cancelled') {
        setStreamError(
          `Cancelado. ${outcome.scenes.filter((v) => v.video_url).length}/${targets.length} videos completados.`,
        );
      }
    } catch (err) {
      console.warn('[video] stream ERROR', err);
      if (err instanceof StreamCancelledError) {
        if (userCancelledRef.current) {
          setStreamError('Generacion de video cancelada.');
          userCancelledRef.current = false;
        }
      } else {
        setStreamError(
          err instanceof Error
            ? err.message
            : 'No se pudieron generar los videos',
        );
      }
    } finally {
      streamAbortRef.current = null;
      setProgress(null);
    }
  }

  function cancelStream() {
    userCancelledRef.current = true;
    streamAbortRef.current?.abort();
    setProgress((p) => (p ? { ...p, message: 'Cancelando...' } : p));
  }

  // ---------- Render ----------
  if (script === null) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 04 - Video"
          title="No hay guion cargado"
          subtitle="Necesitas generar un guion antes de poder armar el video."
          actions={
            <Button
              variant="primary"
              size="md"
              icon={Icon.Wand}
              onClick={() => router.push('/scripts')}
            >
              Ir al prompt
            </Button>
          }
        />
      </div>
    );
  }

  if (eligibleScenes.length === 0) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 04 - Video"
          title="Sin imagenes para convertir"
          subtitle="Generá las imagenes de cada escena antes de pasar a video."
          actions={
            <Button
              variant="primary"
              size="md"
              icon={Icon.Image}
              onClick={() => router.push('/scripts/scenes')}
            >
              Ir a imagenes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        kicker={`Fase 04 - Video - ${done}/${eligibleScenes.length}`}
        title={isStreaming ? 'Generando videos' : allDone ? 'Videos listos' : 'Video de cada escena'}
        subtitle="Cada video tarda 1-3 min y consume creditos de Replicate. Ajustá el prompt de movimiento de camara antes de mandar el lote."
        actions={
          isStreaming ? (
            <Button variant="danger" size="md" icon={Icon.X} onClick={cancelStream}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="md"
                icon={Icon.ArrowL}
                onClick={() => router.push('/scripts/scenes')}
              >
                Volver a imagenes
              </Button>
              <SaveFavoriteButton />
              <Button
                variant="primary"
                size="md"
                icon={Icon.Arrow}
                onClick={() => router.push('/carousel')}
                disabled={!allDone}
                glow
              >
                Continuar a carrusel
              </Button>
            </>
          )
        }
      />

      {(streamError || warning) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {streamError && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--red-soft)',
                border: '1px solid var(--red-ring)',
                color: 'var(--red-hi)',
                fontSize: 12,
              }}
            >
              {streamError}
            </div>
          )}
          {warning && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--warning-soft)',
                border: '1px solid rgba(245,181,68,0.3)',
                color: 'var(--warning)',
                fontSize: 12,
              }}
            >
              {warning}
            </div>
          )}
        </div>
      )}

      {/* Progress bar mientras corre el stream */}
      {isStreaming && progress && (
        <Card padding={16} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: 'var(--blue-soft)',
                border: '1px solid var(--blue-ring)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Spinner size={22} color="var(--blue-hi)" />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
                  {progress.message}
                </span>
                <span
                  className="mono tnum"
                  style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue-hi)' }}
                >
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <ProgressBar
                value={progress.total > 0 ? progress.completed / progress.total : 0}
              />
            </div>
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {/* Sidebar - config global */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 24,
          }}
        >
          <Card padding={18}>
            <div
              className="mono upper"
              style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}
            >
              Modelo
            </div>
            <ModelCard
              id="kling-v3-omni"
              title="Kling v3 Omni"
              blurb="Mantiene identidad usando las referencias. Mas caro y un poco mas lento."
              tag={hasReferenceImages ? 'Recomendado' : 'Sin refs'}
              tagTone={hasReferenceImages ? 'blue' : 'default'}
              active={model === 'kling-v3-omni'}
              onClick={() => setModel('kling-v3-omni')}
              disabled={isStreaming}
            />
            <div style={{ height: 10 }} />
            <ModelCard
              id="kling-v3"
              title="Kling v3"
              blurb="Image-to-video directo. Mas rapido y barato. No usa references."
              tag="Economico"
              tagTone="default"
              active={model === 'kling-v3'}
              onClick={() => setModel('kling-v3')}
              disabled={isStreaming}
            />
          </Card>

          <Card padding={18}>
            <div
              className="mono upper"
              style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}
            >
              Parametros
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-2)',
                  marginBottom: 6,
                }}
              >
                Duracion
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fg-2)',
                  lineHeight: 1.4,
                }}
              >
                Por escena (auto) · viene del guion, redondeada a 3/5/10s
              </div>
            </div>
            <div style={{ height: 14 }} />
            <SegmentedControl
              label="Resolucion"
              value={resolution}
              options={RESOLUTION_OPTIONS.map((r) => ({ v: r, label: r }))}
              onChange={(v) => setResolution(v as '720p' | '1080p')}
              disabled={isStreaming}
            />
            <div style={{ height: 14 }} />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-2)',
                  marginBottom: 6,
                }}
              >
                Sonido nativo
              </div>
              <button
                onClick={() => setSound((s) => !s)}
                disabled={isStreaming}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-1)',
                  border: `1px solid ${sound ? 'var(--blue-ring)' : 'var(--line)'}`,
                  borderRadius: 8,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  opacity: isStreaming ? 0.6 : 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fg-1)',
                }}
              >
                <span>{sound ? 'on' : 'off'}</span>
                <span
                  style={{
                    width: 30,
                    height: 16,
                    borderRadius: 99,
                    background: sound ? 'var(--blue)' : 'var(--bg-3)',
                    position: 'relative',
                    transition: 'background 180ms',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: sound ? 16 : 2,
                      width: 12,
                      height: 12,
                      borderRadius: 99,
                      background: '#fff',
                      transition: 'left 180ms',
                    }}
                  />
                </span>
              </button>
            </div>
            <div style={{ height: 14 }} />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-2)',
                  marginBottom: 6,
                }}
              >
                Aspect ratio
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fg-2)',
                }}
              >
                {form.settings.aspectRatio} · viene de Settings
              </div>
            </div>
          </Card>

          <Card padding={18}>
            <div
              className="mono upper"
              style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}
            >
              Resumen
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--fg-2)',
                lineHeight: 1.7,
              }}
            >
              <div>
                <span style={{ color: 'var(--fg-3)' }}>seleccionadas:</span>{' '}
                <span style={{ color: 'var(--fg-1)', fontWeight: 700 }}>
                  {includedScenes.length} / {eligibleScenes.length}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>duracion total:</span>{' '}
                {includedScenes.reduce(
                  (sum, s) => sum + (durationByScene.get(s.scene_number) ?? 5),
                  0,
                )}s
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>modelo:</span> {model}
              </div>
            </div>
            <div style={{ height: 14 }} />
            <Button
              variant="primary"
              size="lg"
              icon={Icon.Film}
              onClick={startStream}
              disabled={!canSubmit}
              loading={isStreaming}
              glow
              style={{ width: '100%' }}
            >
              {isStreaming
                ? 'Generando...'
                : includedScenes.length === 0
                  ? 'Seleccioná escenas'
                  : !allHavePrompts
                    ? 'Completá prompts'
                    : `Generar ${includedScenes.length} video${includedScenes.length === 1 ? '' : 's'}`}
            </Button>
          </Card>
        </div>

        {/* Grid escenas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {eligibleScenes.map((scene) => {
            const isIncluded = selectedScenes.has(scene.scene_number);
            const prompt = promptsByScene.get(scene.scene_number) ?? '';
            const status = statusByNumber.get(scene.scene_number);
            const prev = previousByScene.get(scene.scene_number);
            const promptUnchanged =
              !!prev &&
              prompt.trim() === (prev.video_prompt ?? '').trim();
            const videoUrl = prev?.local_url || prev?.video_url || null;
            const alreadyDone = !!videoUrl && !prev?.video_error && promptUnchanged;
            const klingDuration = durationByScene.get(scene.scene_number) ?? 5;
            return (
              <SceneVideoCard
                key={scene.scene_number}
                scene={scene}
                isIncluded={isIncluded}
                prompt={prompt}
                status={status}
                videoUrl={videoUrl}
                videoError={prev?.video_error}
                alreadyDone={alreadyDone}
                disabled={isStreaming}
                klingDuration={klingDuration}
                onPrompt={(v) => setPrompt(scene.scene_number, v)}
                onToggle={() => toggleSelected(scene.scene_number)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers seed ----------
function initialPrompts(
  scenes: Array<Scene & { image_url: string }>,
  previousByScene: Map<number, VideoSceneOutput>,
): Map<number, string> {
  const m = new Map<number, string>();
  for (const s of scenes) {
    const fromPrev = previousByScene.get(s.scene_number)?.video_prompt;
    m.set(s.scene_number, fromPrev ?? s.image_prompt ?? '');
  }
  return m;
}

function initialSelection(
  scenes: Array<Scene & { image_url: string }>,
  previousByScene: Map<number, VideoSceneOutput>,
): Set<number> {
  const set = new Set<number>();
  for (const s of scenes) {
    const prev = previousByScene.get(s.scene_number);
    const alreadyDone = !!prev?.video_url && !prev.video_error;
    if (!alreadyDone) set.add(s.scene_number);
  }
  return set;
}

// ---------- Model card ----------
function ModelCard({
  title,
  blurb,
  tag,
  tagTone,
  active,
  onClick,
  disabled,
}: {
  id: string;
  title: string;
  blurb: string;
  tag: string;
  tagTone: 'blue' | 'default';
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 10,
        background: active ? 'var(--blue-soft)' : 'var(--bg-1)',
        border: `1px solid ${active ? 'var(--blue-ring)' : 'var(--line)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 180ms',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: active ? 'var(--blue-hi)' : 'var(--fg-1)',
          }}
        >
          {title}
        </span>
        <Badge tone={tagTone} size="sm">
          {tag}
        </Badge>
      </div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--fg-3)',
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        {blurb}
      </p>
    </button>
  );
}

// ---------- Segmented ----------
function SegmentedControl({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: number | string;
  options: Array<{ v: number | string; label: string }>;
  onChange: (v: number | string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--fg-2)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 4,
          background: 'var(--bg-1)',
          padding: 3,
          borderRadius: 8,
          border: '1px solid var(--line)',
        }}
      >
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            disabled={disabled}
            style={{
              height: 30,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              background: value === o.v ? 'var(--bg-3)' : 'transparent',
              color: value === o.v ? 'var(--fg-1)' : 'var(--fg-3)',
              boxShadow:
                value === o.v
                  ? '0 0 0 1px var(--blue-ring), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              border: 'none',
              fontFamily: 'var(--font-mono)',
              transition: 'all 180ms',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Scene card ----------
function SceneVideoCard({
  scene,
  isIncluded,
  prompt,
  status,
  videoUrl,
  videoError,
  alreadyDone,
  disabled,
  klingDuration,
  onPrompt,
  onToggle,
}: {
  scene: Scene & { image_url: string };
  isIncluded: boolean;
  prompt: string;
  status: VideoStreamStatus | undefined;
  videoUrl: string | null;
  videoError: string | undefined;
  alreadyDone: boolean;
  disabled: boolean;
  klingDuration: number;
  onPrompt: (v: string) => void;
  onToggle: () => void;
}) {
  const isActive = status === 'active';
  const isDone = status === 'done' || (alreadyDone && !!videoUrl);

  const borderColor = isIncluded
    ? 'var(--blue-ring)'
    : alreadyDone
      ? 'var(--success)'
      : 'var(--line)';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-2)',
        border: `1px solid ${borderColor}`,
        boxShadow: isIncluded
          ? '0 0 0 2px var(--blue-soft)'
          : 'var(--shadow-sm)',
        transition: 'all 200ms',
        opacity: !isIncluded && !alreadyDone ? 0.65 : 1,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000' }}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={scene.image_url}
            alt={scene.scene_title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(7,8,11,0.75)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backdropFilter: 'blur(6px)',
          }}
        >
          SC{String(scene.scene_number).padStart(2, '0')}
        </span>

        {isActive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(7,8,11,0.55)',
              display: 'grid',
              placeItems: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Spinner size={28} color="var(--blue-hi)" />
              <span
                className="mono upper"
                style={{ fontSize: 10, color: '#fff', letterSpacing: 1 }}
              >
                Renderizando
              </span>
            </div>
          </div>
        )}

        {isDone && videoUrl && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--success)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon.Check size={10} /> video
          </span>
        )}
        {videoError && !isActive && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--red)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            falló
          </span>
        )}

        {/* Duración aplicada (snappeada desde scene.duration del guion). */}
        <span
          title={`Guion: ${scene.duration}s → Kling: ${klingDuration}s`}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'var(--blue)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.02em',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        >
          {klingDuration}s
        </span>
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--fg-1)',
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {scene.scene_title}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          rows={3}
          disabled={disabled}
          placeholder="Movimiento de camara + accion. Ej: slow dolly in, character turns head and smiles."
          style={{
            width: '100%',
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 11,
            color: 'var(--fg-1)',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'var(--font-mono)',
            minHeight: 60,
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 11,
            color: 'var(--fg-2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={onToggle}
            disabled={disabled}
            style={{ accentColor: 'var(--blue)' }}
          />
          {alreadyDone
            ? 'Regenerar (descartar el video actual)'
            : 'Incluir en el render'}
        </label>
      </div>
    </div>
  );
}

// Silence unused import warning if any tree-shaker complains.
void (Icon as unknown as Record<string, IconComponent>);
