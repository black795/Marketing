'use client';

import { useCallback, useState } from 'react';
import PromptForm, { type PromptContext } from '@/components/PromptForm';
import ProjectHeader from '@/components/ProjectHeader';
import ScenesGrid from '@/components/ScenesGrid';
import SceneDetailPanel from '@/components/SceneDetailPanel';
import TimelineStrip from '@/components/TimelineStrip';
import RegenerateToolbar from '@/components/RegenerateToolbar';
import ScriptReviewPanel from '@/components/ScriptReviewPanel';
import {
  generateImagesFromScript,
  generateScript,
  regenerateImages,
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

  // ---------- Reset ----------
  function handleReset() {
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
    setSettings(DEFAULT_SETTINGS);
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

  // ---------- Fase 3 → 4: imágenes ----------
  async function handleContinueToImages() {
    if (!script || !scriptApproved || !promptCtx) return;
    setPhase('generating-images');
    setScriptError(null);
    try {
      const refDataUrls = promptCtx.referenceImages.map((r) => r.dataUrl);
      const data = await generateImagesFromScript({
        model: promptCtx.model,
        projectId: script.projectId,
        scenes: script.scenes,
        quality: settings.quality,
        aspectRatio: settings.aspectRatio,
        referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
      });

      const merged: GenerateStoryResponse = {
        success: data.success,
        projectId: script.projectId,
        model: promptCtx.model,
        title: script.title,
        style: script.style,
        characters: script.characters,
        scenes: data.scenes,
      };
      setResult(merged);
      setPhase('result');
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : 'No se pudieron generar las imágenes'
      );
      setPhase('script-review');
    }
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

    try {
      const refDataUrls = promptCtx?.referenceImages.map((r) => r.dataUrl) ?? [];
      const response = await regenerateImages({
        model: result.model,
        scenes: scenesToRegen.map((s) => ({
          scene_number: s.scene_number,
          image_prompt: s.image_prompt,
        })),
        quality: settings.quality,
        aspectRatio: settings.aspectRatio,
        referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
      });

      const byNumber = new Map(
        response.results.map((r) => [r.scene_number, r])
      );

      setResult((prev) => {
        if (!prev) return prev;
        const updatedScenes = prev.scenes.map((scene) => {
          const r = byNumber.get(scene.scene_number);
          if (!r) return scene;
          const { image_error, ...rest } = scene;
          return {
            ...rest,
            image_url: r.image_url,
            ...(r.image_error ? { image_error: r.image_error } : {}),
          };
        });
        return { ...prev, scenes: updatedScenes };
      });

      const failed = response.results.filter((r) => !r.image_url);
      if (failed.length > 0) {
        setRegenError(
          `${failed.length} de ${response.results.length} no se regeneraron correctamente.`
        );
      }

      setSelectedForRegen(new Set());
    } catch (err) {
      setRegenError(
        err instanceof Error ? err.message : 'Error al regenerar imágenes'
      );
    } finally {
      setRegenerating(false);
      setRegeneratingNumbers(new Set());
    }
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
            <LoadingCard
              label="Generando imágenes del guion aprobado…"
              detail={`${script.scenes.length} escenas en cola. Procesamos secuencialmente para evitar rate limits de Replicate.`}
            />
            <SkeletonGrid count={script.scenes.length} />
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
            <RegenerateToolbar
              selectedCount={selectedForRegen.size}
              totalCount={result.scenes.length}
              regenerating={regenerating}
              error={regenError}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onCancel={toggleSelectionMode}
              onRegenerate={handleRegenerateSelected}
            />
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
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-brand-pink" />
        <p className="text-sm font-semibold text-neutral-800">{label}</p>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  const n = Math.min(Math.max(count, 3), 6);
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
        >
          <div
            className="w-full animate-pulse bg-neutral-200"
            style={{ aspectRatio: '9 / 16' }}
          />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
