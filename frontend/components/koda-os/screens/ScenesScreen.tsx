'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  Spinner,
} from '../primitives';
import { projectStore, useProject } from '../project-store';
import SceneAdvancedPanel from '../SceneAdvancedPanel';
import {
  streamGenerateImagesFromScript,
  streamRegenerateImages,
  StreamCancelledError,
} from '@/lib/api';
import type { Scene } from '@/types/story';

type StreamStatus = 'pending' | 'active' | 'done' | 'error';

type Progress = {
  total: number;
  completed: number;
  message: string;
};

export default function ScenesScreen() {
  const router = useRouter();
  const { script, scriptApproved, scenes, form } = useProject();

  const [statusByNumber, setStatusByNumber] = useState<Map<number, StreamStatus>>(
    () => new Map(),
  );
  const [progress, setProgress] = useState<Progress | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  const userCancelledRef = useRef(false);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForRegen, setSelectedForRegen] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);
  const userCancelledRegenRef = useRef(false);

  // Auto-start image generation on first mount when scenes don't have real data.
  // Resume-from-session: if scenes already have image_url/image_error, skip.
  // StrictMode dev: ignore placeholders left over from an aborted first mount.
  useEffect(() => {
    if (!script || !scriptApproved) {
      console.log('[scenes] auto-start SKIP', {
        hasScript: !!script,
        scriptApproved,
      });
      return;
    }
    if (startedRef.current) {
      console.log('[scenes] auto-start SKIP startedRef=true');
      return;
    }
    const hasRealData =
      scenes !== null &&
      scenes.some((s) => s.image_url != null || s.image_error != null);
    if (hasRealData) {
      console.log('[scenes] auto-start SKIP scenes already have real data');
      return;
    }
    console.log('[scenes] auto-start FIRE', {
      sceneCount: script.scenes.length,
      model: form.model,
      refs: form.references.length,
    });
    startedRef.current = true;
    void runImageStream(script.scenes, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, scriptApproved]);

  // Cleanup any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      regenAbortRef.current?.abort();
    };
  }, []);

  async function runImageStream(targetScenes: Scene[], isRetry: boolean) {
    if (!script) return;

    // Seed placeholders solo si no hay scenes ya (preserva progreso si HMR
    // / Fast Refresh re-monta el componente con un stream a medio camino).
    const existing = projectStore.get().scenes;
    const sameShape =
      existing !== null &&
      existing.length === targetScenes.length &&
      existing.every((s, i) => s.scene_number === targetScenes[i].scene_number);
    if (!isRetry && !sameShape) {
      const placeholders: Scene[] = targetScenes.map((s) => ({
        ...s,
        image_url: null,
      }));
      projectStore.setScenes(placeholders);
    }
    const initialStatus = new Map<number, StreamStatus>(
      targetScenes.map((s) => {
        const existingScene = existing?.find(
          (e) => e.scene_number === s.scene_number,
        );
        const status: StreamStatus = existingScene?.image_url
          ? 'done'
          : existingScene?.image_error
            ? 'error'
            : 'pending';
        return [s.scene_number, status];
      }),
    );
    setStatusByNumber(initialStatus);
    setProgress({
      total: targetScenes.length,
      completed: 0,
      message: 'Conectando con el worker...',
    });
    setWarning(null);
    setStreamError(null);

    const abort = new AbortController();
    streamAbortRef.current = abort;
    console.log('[scenes] POST → /api/generate-images-from-script', {
      scenes: targetScenes.length,
      model: form.model,
      refs: form.references.length,
    });

    try {
      const refDataUrls = form.references.map((r) => r.dataUrl);
      const outcome = await streamGenerateImagesFromScript(
        {
          model: form.model,
          projectId: script.projectId,
          scenes: targetScenes,
          quality: form.settings.quality,
          aspectRatio: form.settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onStart: ({ total }) => {
            console.log('[scenes] SSE event=start', { total });
            setProgress({
              total,
              completed: 0,
              message: 'Encolando escenas...',
            });
          },
          onSceneStart: ({ scene_number, index, total }) => {
            console.log('[scenes] SSE event=scene-start', {
              scene_number,
              index,
              total,
            });
            setStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(scene_number, 'active');
              return next;
            });
            setProgress({
              total,
              completed: index,
              message: `Generando escena ${scene_number}...`,
            });
          },
          onScene: ({ scene, index, total }) => {
            console.log('[scenes] SSE event=scene-done', {
              scene_number: scene.scene_number,
              hasUrl: !!scene.image_url,
              hasError: !!scene.image_error,
              index,
              total,
            });
            // Reemplazo completo (matchea conducta del legacy: la escena del
            // backend trae todos los campos, no solo image_url).
            projectStore.replaceScene(scene);
            setStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(scene.scene_number, scene.image_url ? 'done' : 'error');
              return next;
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
            console.warn('[scenes] SSE event=warning', msg);
            setWarning(msg);
          },
        },
        abort.signal,
      );
      console.log('[scenes] stream OUTCOME', outcome.status, {
        scenes: outcome.scenes.length,
        failed: outcome.failed,
      });

      if (outcome.status === 'cancelled') {
        setStreamError(
          `Cancelado. ${outcome.scenes.filter((s) => s.image_url).length}/${targetScenes.length} generadas.`,
        );
      }
    } catch (err) {
      console.warn('[scenes] stream ERROR', err);
      if (err instanceof StreamCancelledError) {
        if (userCancelledRef.current) {
          setStreamError('Generacion cancelada.');
          userCancelledRef.current = false;
        } else {
          startedRef.current = false;
        }
      } else {
        setStreamError(
          err instanceof Error ? err.message : 'No se pudieron generar las imagenes',
        );
      }
    } finally {
      streamAbortRef.current = null;
      setProgress(null);
    }
  }

  async function regenerateSelected() {
    const current = projectStore.get().scenes;
    if (!current || selectedForRegen.size === 0 || regenerating) return;
    const targets = current.filter((s) => selectedForRegen.has(s.scene_number));

    setRegenerating(true);
    setRegenError(null);
    setStatusByNumber((prev) => {
      const next = new Map(prev);
      for (const s of targets) next.set(s.scene_number, 'active');
      return next;
    });

    const abort = new AbortController();
    regenAbortRef.current = abort;

    try {
      const refDataUrls = form.references.map((r) => r.dataUrl);
      const outcome = await streamRegenerateImages(
        {
          model: form.model,
          scenes: targets.map((s) => ({
            scene_number: s.scene_number,
            image_prompt: s.image_prompt,
          })),
          quality: form.settings.quality,
          aspectRatio: form.settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onResult: ({ result }) => {
            projectStore.updateScene(result.scene_number, {
              image_url: result.image_url,
              image_error: result.image_error,
            });
            setStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(result.scene_number, result.image_url ? 'done' : 'error');
              return next;
            });
          },
        },
        abort.signal,
      );

      if (outcome.failed > 0) {
        setRegenError(`${outcome.failed} no se regeneraron correctamente.`);
      }
      setSelectedForRegen(new Set());
      setSelectionMode(false);
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        if (userCancelledRegenRef.current) {
          setRegenError('Regeneracion cancelada.');
          userCancelledRegenRef.current = false;
        }
      } else {
        setRegenError(err instanceof Error ? err.message : 'Error al regenerar');
      }
    } finally {
      setRegenerating(false);
      regenAbortRef.current = null;
    }
  }

  if (!script) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 03 - Imagenes"
          title="No hay guion cargado"
          subtitle="Tenes que generar un guion primero antes de crear las imagenes."
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

  if (!scriptApproved) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 03 - Imagenes"
          title="Guion sin aprobar"
          subtitle="Revisa y aprueba el guion antes de pedir las imagenes a Replicate."
          actions={
            <Button
              variant="primary"
              size="md"
              icon={Icon.ArrowL}
              onClick={() => router.push('/scripts/review')}
            >
              Ir a revision
            </Button>
          }
        />
      </div>
    );
  }

  const renderScenes: Scene[] = scenes ?? script.scenes.map((s) => ({ ...s, image_url: null }));
  const total = renderScenes.length;
  const done = renderScenes.filter((s) => s.image_url).length;
  const isStreaming = !!progress;
  const allDone = done === total && total > 0;

  function toggleSelect(i: number) {
    if (!selectionMode) {
      setSelectedIdx(i);
      return;
    }
    const sceneNum = renderScenes[i].scene_number;
    const next = new Set(selectedForRegen);
    if (next.has(sceneNum)) next.delete(sceneNum);
    else next.add(sceneNum);
    setSelectedForRegen(next);
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        kicker={`Fase 03 - Imagenes - ${done}/${total}`}
        title={isStreaming ? 'Generando escenas' : allDone ? 'Imagenes listas' : 'Escenas'}
        subtitle="Replicate procesa una escena a la vez (burst=1). Las imagenes aparecen vivas conforme se generan."
        actions={
          <>
            {selectionMode ? (
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedForRegen(new Set());
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  icon={Icon.Refresh}
                  loading={regenerating}
                  disabled={selectedForRegen.size === 0}
                  onClick={regenerateSelected}
                >
                  Regenerar {selectedForRegen.size}
                </Button>
              </>
            ) : (
              <>
                {isStreaming && (
                  <Button
                    variant="danger"
                    size="md"
                    icon={Icon.X}
                    onClick={() => {
                      userCancelledRef.current = true;
                      streamAbortRef.current?.abort();
                      setProgress((p) =>
                        p ? { ...p, message: 'Cancelando...' } : p,
                      );
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  icon={Icon.Refresh}
                  onClick={() => setSelectionMode(true)}
                  disabled={done === 0 || isStreaming}
                >
                  Modo regen
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={Icon.Arrow}
                  onClick={() => router.push('/storyboard')}
                  glow
                  disabled={!allDone}
                >
                  Continuar al storyboard
                </Button>
              </>
            )}
          </>
        }
      />

      {(streamError || regenError) && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--red-soft)',
            border: '1px solid var(--red-ring)',
            color: 'var(--red-hi)',
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {streamError || regenError}
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
            marginBottom: 16,
          }}
        >
          {warning}
        </div>
      )}

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
            {isStreaming || regenerating ? (
              <Spinner size={22} color="var(--blue-hi)" />
            ) : allDone ? (
              <Icon.Check size={22} />
            ) : (
              <Icon.Image size={22} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>
                  {progress?.message || (allDone ? 'Todas las imagenes listas' : 'Listo para generar')}
                </span>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    fontFamily: 'var(--font-mono)',
                    marginTop: 2,
                  }}
                >
                  {form.model} - {form.settings.quality} - {form.settings.aspectRatio}
                </div>
              </div>
              <div
                className="mono tnum"
                style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue-hi)' }}
              >
                {String(done).padStart(2, '0')}
                <span style={{ color: 'var(--fg-3)', fontSize: 18 }}>/{String(total).padStart(2, '0')}</span>
              </div>
            </div>
            <ProgressBar value={total > 0 ? done / total : 0} />
          </div>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {renderScenes.map((s, i) => (
          <SceneCardEl
            key={s.scene_number}
            scene={s}
            status={statusByNumber.get(s.scene_number) ?? (s.image_url ? 'done' : 'pending')}
            isSelected={
              selectionMode ? selectedForRegen.has(s.scene_number) : selectedIdx === i
            }
            selectionMode={selectionMode}
            onClick={() => toggleSelect(i)}
          />
        ))}
      </div>

      {selectedIdx !== null && !selectionMode && renderScenes[selectedIdx] && (
        <SceneAdvancedPanel
          scene={renderScenes[selectedIdx]}
          onClose={() => setSelectedIdx(null)}
          onPrev={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
          onNext={() =>
            setSelectedIdx(Math.min(renderScenes.length - 1, selectedIdx + 1))
          }
        />
      )}
    </div>
  );
}

function SceneCardEl({
  scene,
  status,
  isSelected,
  selectionMode,
  onClick,
}: {
  scene: Scene;
  status: StreamStatus;
  isSelected: boolean;
  selectionMode: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isActive = status === 'active';
  const isPending = status === 'pending';
  const isDone = status === 'done' && !!scene.image_url;
  const isError = status === 'error' || !!scene.image_error;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-2)',
        border: `1px solid ${isSelected ? 'var(--blue)' : isActive ? 'var(--blue-ring)' : 'var(--line)'}`,
        boxShadow: isSelected
          ? '0 0 0 3px var(--blue-soft)'
          : hover
            ? 'var(--shadow-md)'
            : 'var(--shadow-sm)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 220ms var(--ease-out)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ position: 'relative' }}>
        {isDone ? (
          <div style={{ aspectRatio: '9 / 16', width: '100%', background: 'var(--bg-3)' }}>
            <img
              src={scene.image_url || ''}
              alt={scene.scene_title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div
            className={isActive ? '' : 'skeleton'}
            style={{
              aspectRatio: '9 / 16',
              width: '100%',
              background: isActive ? 'var(--bg-3)' : undefined,
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
          >
            {isActive && (
              <div
                className="anim-fade-up"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <div
                  className="pulse-ring"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 99,
                    background: 'var(--blue-soft)',
                    border: '1px solid var(--blue-ring)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Spinner size={16} color="var(--blue-hi)" />
                </div>
                <span
                  className="mono upper"
                  style={{ fontSize: 9, color: 'var(--blue-hi)', letterSpacing: 1 }}
                >
                  Generando...
                </span>
              </div>
            )}
            {isPending && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span
                  className="breath"
                  style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--fg-3)' }}
                />
                <span
                  className="mono upper"
                  style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: 1 }}
                >
                  en cola
                </span>
              </div>
            )}
            {isError && !isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Icon.X size={20} />
                <span
                  className="mono upper"
                  style={{ fontSize: 9, color: 'var(--red-hi)', letterSpacing: 1 }}
                >
                  error
                </span>
              </div>
            )}
          </div>
        )}

        {selectionMode && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: 99,
              background: isSelected ? 'var(--blue)' : 'rgba(7,8,11,0.7)',
              border: `1.5px solid ${isSelected ? 'var(--blue)' : '#fff'}`,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
          >
            {isSelected && <Icon.Check size={12} />}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--fg-1)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {scene.scene_title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            SC{String(scene.scene_number).padStart(2, '0')} - {scene.duration}s
          </span>
          {isDone && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                color: 'var(--success)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Icon.Check size={10} /> listo
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

