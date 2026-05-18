'use client';

import { useCallback, useRef, useState } from 'react';
import PromptForm, { type PromptContext } from '@/components/PromptForm';
import ProjectHeader from '@/components/ProjectHeader';
import ScenesGrid from '@/components/ScenesGrid';
import SceneDetailPanel from '@/components/SceneDetailPanel';
import TimelineStrip from '@/components/TimelineStrip';
import RegenerateToolbar from '@/components/RegenerateToolbar';
import ScriptReviewPanel from '@/components/ScriptReviewPanel';
import LoadingButton from '@/components/loading/LoadingButton';
import ProgressBar from '@/components/loading/ProgressBar';
import Spinner from '@/components/loading/Spinner';
import type { SceneStreamStatus } from '@/components/SceneCard';
import {
  generateScript,
  streamGenerateImagesFromScript,
  streamRegenerateImages,
  StreamCancelledError,
} from '@/lib/api';
import {
  DEFAULT_SETTINGS,
  type GenerationSettings,
} from '@/lib/generation-settings';
import type {
  GenerateScriptResponse,
  GenerateStoryResponse,
  Scene,
} from '@/types/story';

type Phase =
  | 'idle'
  | 'generating-script'
  | 'script-review'
  | 'generating-images'
  | 'result';

interface StreamProgress {
  total: number;
  completed: number;
  currentSceneNumber: number | null;
  message: string;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle');

  const [script, setScript] = useState<GenerateScriptResponse | null>(null);
  const [scriptApproved, setScriptApproved] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [promptCtx, setPromptCtx] = useState<PromptContext | null>(null);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);

  const [result, setResult] = useState<GenerateStoryResponse | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForRegen, setSelectedForRegen] = useState<Set<number>>(
    () => new Set()
  );
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingNumbers, setRegeneratingNumbers] = useState<Set<number>>(
    () => new Set()
  );
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenProgress, setRegenProgress] = useState<StreamProgress | null>(
    null
  );
  const regenAbortRef = useRef<AbortController | null>(null);

  // Streaming de generación inicial de imágenes
  const [streamScenes, setStreamScenes] = useState<Scene[]>([]);
  const [streamStatusByNumber, setStreamStatusByNumber] = useState<
    Map<number, SceneStreamStatus>
  >(() => new Map());
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(
    null
  );
  const [streamWarning, setStreamWarning] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  // ---------- Reset ----------
  function handleReset() {
    streamAbortRef.current?.abort();
    regenAbortRef.current?.abort();
    setPhase('idle');
    setScript(null);
    setScriptApproved(false);
    setScriptError(null);
    setPromptCtx(null);
    setResult(null);
    setSelectedScene(null);
    setSelectionMode(false);
    setSelectedForRegen(new Set());
    setRegenError(null);
    setRegenProgress(null);
    setSettings(DEFAULT_SETTINGS);
    setStreamScenes([]);
    setStreamStatusByNumber(new Map());
    setStreamProgress(null);
    setStreamWarning(null);
  }

  // ---------- Fase 1 → 2: guion ----------
  function handleScript(data: GenerateScriptResponse, ctx: PromptContext) {
    setScript(data);
    setPromptCtx(ctx);
    setSettings(ctx.settings);
    setScriptApproved(false);
    setScriptError(null);
    setPhase('script-review');
  }

  function handleScriptLoadingChange(loading: boolean) {
    setPhase((prev) => {
      if (loading) return 'generating-script';
      if (prev === 'generating-script' && !script) return 'idle';
      return prev;
    });
  }

  async function handleRegenerateScript() {
    if (!promptCtx || regeneratingScript) return;
    setRegeneratingScript(true);
    setScriptError(null);
    try {
      const refDataUrls = promptCtx.referenceImages.map((r) => r.dataUrl);
      const data = await generateScript({
        visualPrompt: promptCtx.visualPrompt,
        narrativePrompt: promptCtx.narrativePrompt || undefined,
        model: promptCtx.model,
        referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        sceneCount: settings.sceneCount,
      });
      setScript(data);
      setScriptApproved(false);
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : 'No se pudo regenerar el guion'
      );
    } finally {
      setRegeneratingScript(false);
    }
  }

  // ---------- Fase 3 → 4: imágenes (con SSE) ----------
  async function handleContinueToImages() {
    if (!script || !scriptApproved || !promptCtx) return;

    setScriptError(null);
    setPhase('generating-images');

    const placeholderScenes: Scene[] = script.scenes.map((s) => ({
      ...s,
      image_url: null,
    }));
    setStreamScenes(placeholderScenes);
    const initialStatus = new Map<number, SceneStreamStatus>(
      placeholderScenes.map((s) => [s.scene_number, 'pending' as const])
    );
    setStreamStatusByNumber(initialStatus);
    setStreamProgress({
      total: script.scenes.length,
      completed: 0,
      currentSceneNumber: null,
      message: 'Conectando con el worker…',
    });
    setStreamWarning(null);

    const abort = new AbortController();
    streamAbortRef.current = abort;

    try {
      const refDataUrls = promptCtx.referenceImages.map((r) => r.dataUrl);
      const outcome = await streamGenerateImagesFromScript(
        {
          model: promptCtx.model,
          projectId: script.projectId,
          scenes: script.scenes,
          quality: settings.quality,
          aspectRatio: settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onStart: ({ total }) => {
            setStreamProgress({
              total,
              completed: 0,
              currentSceneNumber: null,
              message: 'Encolando escenas…',
            });
          },
          onSceneStart: ({ scene_number, index, total }) => {
            setStreamStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(scene_number, 'active');
              return next;
            });
            setStreamProgress({
              total,
              completed: index,
              currentSceneNumber: scene_number,
              message: `Generando escena ${scene_number} de ${total}…`,
            });
          },
          onScene: ({ scene, index, total }) => {
            setStreamScenes((prev) => {
              const idx = prev.findIndex(
                (s) => s.scene_number === scene.scene_number
              );
              if (idx < 0) return [...prev, scene];
              const next = prev.slice();
              next[idx] = scene;
              return next;
            });
            setStreamStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(
                scene.scene_number,
                scene.image_url ? 'done' : 'error'
              );
              return next;
            });
            setStreamProgress({
              total,
              completed: index,
              currentSceneNumber: null,
              message:
                index === total
                  ? 'Finalizando…'
                  : `Escena ${scene.scene_number} lista (${index}/${total})`,
            });
          },
          onWarning: (msg) => setStreamWarning(msg),
        },
        abort.signal
      );

      const finalScenes =
        outcome.scenes.length === script.scenes.length
          ? outcome.scenes
          : mergeScenes(placeholderScenes, outcome.scenes);

      const merged: GenerateStoryResponse = {
        success: outcome.status === 'done',
        projectId: script.projectId,
        model: promptCtx.model,
        title: script.title,
        style: script.style,
        characters: script.characters,
        scenes: finalScenes,
      };
      setResult(merged);

      if (outcome.status === 'cancelled') {
        setScriptError('Generación cancelada. Volvemos al guion.');
        setPhase('script-review');
      } else {
        setPhase('result');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setScriptError('Generación cancelada.');
      } else {
        setScriptError(
          err instanceof Error
            ? err.message
            : 'No se pudieron generar las imágenes'
        );
      }
      setPhase('script-review');
    } finally {
      streamAbortRef.current = null;
      setStreamProgress(null);
    }
  }

  function handleCancelImageStream() {
    streamAbortRef.current?.abort();
    setStreamProgress((p) =>
      p ? { ...p, message: 'Cancelando…' } : p
    );
  }

  // ---------- Fase 5: selección + regeneración de imágenes ----------
  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedForRegen(new Set());
        setRegenError(null);
      } else {
        setSelectedScene(null);
      }
      return next;
    });
  }

  const handleSelectScene = useCallback(
    (scene: Scene) => {
      if (selectionMode) {
        setSelectedForRegen((prev) => {
          const next = new Set(prev);
          if (next.has(scene.scene_number)) next.delete(scene.scene_number);
          else next.add(scene.scene_number);
          return next;
        });
        return;
      }
      setSelectedScene(scene);
    },
    [selectionMode]
  );

  function handleSelectAll() {
    if (!result) return;
    setSelectedForRegen(new Set(result.scenes.map((s) => s.scene_number)));
  }

  function handleClearSelection() {
    setSelectedForRegen(new Set());
  }

  async function handleRegenerateSelected() {
    if (!result || selectedForRegen.size === 0 || regenerating) return;

    const scenesToRegen = result.scenes.filter((s) =>
      selectedForRegen.has(s.scene_number)
    );

    setRegenerating(true);
    setRegenError(null);
    setRegeneratingNumbers(new Set(scenesToRegen.map((s) => s.scene_number)));
    setRegenProgress({
      total: scenesToRegen.length,
      completed: 0,
      currentSceneNumber: null,
      message: 'Conectando…',
    });

    const abort = new AbortController();
    regenAbortRef.current = abort;

    try {
      const refDataUrls = promptCtx?.referenceImages.map((r) => r.dataUrl) ?? [];
      const outcome = await streamRegenerateImages(
        {
          model: result.model,
          scenes: scenesToRegen.map((s) => ({
            scene_number: s.scene_number,
            image_prompt: s.image_prompt,
          })),
          quality: settings.quality,
          aspectRatio: settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onStart: ({ total }) =>
            setRegenProgress({
              total,
              completed: 0,
              currentSceneNumber: null,
              message: `Regenerando ${total} imagen${total === 1 ? '' : 'es'}…`,
            }),
          onSceneStart: ({ scene_number, index, total }) =>
            setRegenProgress({
              total,
              completed: index,
              currentSceneNumber: scene_number,
              message: `Regenerando escena ${scene_number}…`,
            }),
          onResult: ({ result: r, index, total }) => {
            setResult((prev) => {
              if (!prev) return prev;
              const updatedScenes = prev.scenes.map((scene) => {
                if (scene.scene_number !== r.scene_number) return scene;
                const { image_error: _ignored, ...rest } = scene;
                return {
                  ...rest,
                  image_url: r.image_url,
                  ...(r.image_error ? { image_error: r.image_error } : {}),
                };
              });
              return { ...prev, scenes: updatedScenes };
            });
            setRegeneratingNumbers((prev) => {
              const next = new Set(prev);
              next.delete(r.scene_number);
              return next;
            });
            setRegenProgress({
              total,
              completed: index,
              currentSceneNumber: null,
              message:
                index === total
                  ? 'Finalizando…'
                  : `${index}/${total} regeneradas`,
            });
          },
        },
        abort.signal
      );

      if (outcome.status === 'cancelled') {
        setRegenError(
          `Cancelado. ${outcome.results.length} de ${scenesToRegen.length} regeneradas.`
        );
      } else if (outcome.failed > 0) {
        setRegenError(
          `${outcome.failed} de ${outcome.results.length} no se regeneraron correctamente.`
        );
      }

      setSelectedForRegen(new Set());
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setRegenError('Regeneración cancelada.');
      } else {
        setRegenError(
          err instanceof Error ? err.message : 'Error al regenerar imágenes'
        );
      }
    } finally {
      setRegenerating(false);
      setRegeneratingNumbers(new Set());
      setRegenProgress(null);
      regenAbortRef.current = null;
    }
  }

  function handleCancelRegen() {
    regenAbortRef.current?.abort();
    setRegenProgress((p) =>
      p ? { ...p, message: 'Cancelando…' } : p
    );
  }

  // ---------- Render ----------
  const generatingImages = phase === 'generating-images';

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8 pb-40">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Contenido <span className="text-brand-pink">TIAAT</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Guion → revisión → imágenes → video
          </p>
        </header>

        <PhaseStepper phase={phase} />

        {phase === 'idle' && (
          <EmptyState>
            <PromptForm
              onScript={handleScript}
              onLoadingChange={handleScriptLoadingChange}
            />
          </EmptyState>
        )}

        {phase === 'generating-script' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <PromptForm
                onScript={handleScript}
                onLoadingChange={handleScriptLoadingChange}
                initialVisualPrompt={promptCtx?.visualPrompt}
                initialNarrativePrompt={promptCtx?.narrativePrompt}
                initialModel={promptCtx?.model}
                initialSettings={settings}
                initialReferences={promptCtx?.referenceImages}
              />
            </div>
            <LoadingCard
              label="Escribiendo el guion…"
              detail="Claude está armando título, personajes y escenas a partir de tus prompts."
            />
          </div>
        )}

        {phase === 'script-review' && script && (
          <ScriptReviewPanel
            script={script}
            approved={scriptApproved}
            regenerating={regeneratingScript}
            generatingImages={false}
            error={scriptError}
            settings={settings}
            onSettingsChange={setSettings}
            onChange={(next) => {
              setScript(next);
              setScriptApproved(false);
            }}
            onApprove={() => setScriptApproved(true)}
            onUnapprove={() => setScriptApproved(false)}
            onRegenerate={handleRegenerateScript}
            onContinue={handleContinueToImages}
          />
        )}

        {phase === 'generating-images' && script && (
          <div className="space-y-6">
            <StreamingProgressCard
              progress={streamProgress}
              warning={streamWarning}
              onCancel={handleCancelImageStream}
            />
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Escenas en vivo
                </h2>
                <p className="text-xs text-neutral-500">
                  {countDone(streamStatusByNumber)} de {script.scenes.length}{' '}
                  generadas
                </p>
              </div>
              <ScenesGrid
                scenes={streamScenes}
                streamStatusByNumber={streamStatusByNumber}
                onSelectScene={(s) => setSelectedScene(s)}
              />
            </section>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-6">
            <ProjectHeader
              project={result}
              selectionMode={selectionMode}
              regenerating={regenerating}
              onReset={handleReset}
              onToggleSelectionMode={toggleSelectionMode}
            />

            <details className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
                Ver guion aprobado
              </summary>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                {result.style && (
                  <p className="text-neutral-500">{result.style}</p>
                )}
                <ol className="space-y-2">
                  {result.scenes.map((s) => (
                    <li
                      key={s.scene_number}
                      className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-neutral-900">
                        #{s.scene_number} · {s.scene_title}
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        {s.narration}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </details>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Escenas
              </h2>
              <ScenesGrid
                scenes={result.scenes}
                selectedSceneNumber={selectedScene?.scene_number ?? null}
                selectionMode={selectionMode}
                selectedForRegen={selectedForRegen}
                regeneratingNumbers={regeneratingNumbers}
                onSelectScene={handleSelectScene}
              />
            </section>
          </div>
        )}
      </div>

      {phase === 'result' && result && (
        <div className="fixed bottom-0 left-0 right-0 z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          {selectionMode && (
            <>
              {regenerating && regenProgress && (
                <div className="border-b border-neutral-200 bg-white/95 backdrop-blur">
                  <div className="mx-auto max-w-7xl px-6 py-2.5">
                    <ProgressBar
                      value={
                        regenProgress.total > 0
                          ? regenProgress.completed / regenProgress.total
                          : null
                      }
                      label={regenProgress.message}
                      showPercent
                    />
                  </div>
                </div>
              )}
              <RegenerateToolbar
                selectedCount={selectedForRegen.size}
                totalCount={result.scenes.length}
                regenerating={regenerating}
                error={regenError}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                onCancel={
                  regenerating ? handleCancelRegen : toggleSelectionMode
                }
                onRegenerate={handleRegenerateSelected}
              />
            </>
          )}
          <TimelineStrip
            scenes={result.scenes}
            selectedSceneNumber={selectedScene?.scene_number ?? null}
            onSelectScene={(s) => {
              if (!selectionMode) setSelectedScene(s);
            }}
          />
        </div>
      )}

      <SceneDetailPanel
        scene={selectedScene}
        onClose={() => setSelectedScene(null)}
      />
    </main>
  );
}

// ---------- helpers ----------

function mergeScenes(base: Scene[], updates: Scene[]): Scene[] {
  const map = new Map(base.map((s) => [s.scene_number, s]));
  for (const u of updates) {
    map.set(u.scene_number, u);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.scene_number - b.scene_number
  );
}

function countDone(map: Map<number, SceneStreamStatus>): number {
  let n = 0;
  for (const v of map.values()) if (v === 'done' || v === 'error') n++;
  return n;
}

// ---------- subcomponentes locales ----------

function PhaseStepper({ phase }: { phase: Phase }) {
  const steps: Array<{ key: Phase | Phase[]; label: string }> = [
    { key: ['idle', 'generating-script'], label: '1 · Prompts' },
    { key: 'script-review', label: '2 · Guion' },
    { key: ['generating-images', 'result'], label: '3 · Imágenes' },
    { key: 'result', label: '4 · Video (próx.)' },
  ];

  function isActive(key: Phase | Phase[]): boolean {
    return Array.isArray(key) ? key.includes(phase) : key === phase;
  }

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs">
      {steps.map((step, idx) => {
        const active = isActive(step.key);
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.label} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 font-semibold transition ${
                active
                  ? 'bg-brand-pink text-white'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {step.label}
            </span>
            {!isLast && (
              <span aria-hidden="true" className="text-neutral-300">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          Empieza con dos prompts
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Uno define cómo se ve. El otro define qué se cuenta. Claude arma el
          guion antes de pedir una sola imagen.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function LoadingCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Spinner size={18} className="text-brand-pink" />
        <p className="text-sm font-semibold text-neutral-800">{label}</p>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{detail}</p>
      <div className="mt-3">
        <ProgressBar value={null} showPercent={false} />
      </div>
    </div>
  );
}

function StreamingProgressCard({
  progress,
  warning,
  onCancel,
}: {
  progress: StreamProgress | null;
  warning: string | null;
  onCancel: () => void;
}) {
  const value =
    progress && progress.total > 0
      ? progress.completed / progress.total
      : null;
  const message = progress?.message ?? 'Generando imágenes…';

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Spinner size={18} className="text-brand-pink" />
            <p className="text-sm font-semibold text-neutral-800">
              Generando imágenes en tiempo real
            </p>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{message}</p>
          <div className="mt-3">
            <ProgressBar
              value={value}
              showPercent
              detail={
                progress
                  ? `${progress.completed} de ${progress.total} escenas listas`
                  : undefined
              }
            />
          </div>
          {warning && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              ⚠ {warning}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start">
          <LoadingButton
            variant="danger"
            onClick={onCancel}
            leftIcon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            }
          >
            Cancelar generación
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
