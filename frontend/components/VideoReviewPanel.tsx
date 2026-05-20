'use client';

import { useMemo, useState } from 'react';
import type { Scene, VideoModel, VideoSceneOutput } from '@/types/story';
import CostConfirmDialog from './CostConfirmDialog';
import LoadingButton from './loading/LoadingButton';

export interface VideoGenerationDecision {
  model: VideoModel;
  duration: number;
  resolution: '720p' | '1080p';
  sound: boolean;
  aspectRatio: string;
  scenes: Array<{
    scene_number: number;
    image_url: string;
    video_prompt: string;
  }>;
}

interface VideoReviewPanelProps {
  scenes: Scene[];
  hasReferenceImages: boolean;
  aspectRatio: string;
  /** Estado previo si el usuario vuelve a editar desde video-result. */
  initialDecision?: VideoGenerationDecision | null;
  /**
   * Resultados de la última corrida (si los hay). Cada escena con `video_url`
   * exitoso muestra badge "✓ Video generado" y queda desmarcada por defecto
   * — sólo se regenera si el usuario edita su prompt o la marca explícitamente.
   */
  previousResults?: VideoSceneOutput[];
  onBack: () => void;
  onConfirm: (decision: VideoGenerationDecision) => void;
}

const DURATION_OPTIONS = [3, 5, 10] as const;
const RESOLUTION_OPTIONS: Array<'720p' | '1080p'> = ['720p', '1080p'];

export default function VideoReviewPanel({
  scenes,
  hasReferenceImages,
  aspectRatio,
  initialDecision,
  previousResults,
  onBack,
  onConfirm,
}: VideoReviewPanelProps) {
  // Sólo escenas con imagen sirven para image-to-video.
  const eligibleScenes = useMemo(
    () => scenes.filter((s): s is Scene & { image_url: string } => !!s.image_url),
    [scenes]
  );

  // Mapa de previousResults por scene_number para lookup rápido.
  const previousByScene = useMemo(() => {
    const m = new Map<number, VideoSceneOutput>();
    for (const p of previousResults ?? []) m.set(p.scene_number, p);
    return m;
  }, [previousResults]);

  const [model, setModel] = useState<VideoModel>(
    initialDecision?.model ??
      (hasReferenceImages ? 'kling-v3-omni' : 'kling-v3')
  );
  const [duration, setDuration] = useState<number>(
    initialDecision?.duration ?? 5
  );
  const [resolution, setResolution] = useState<'720p' | '1080p'>(
    initialDecision?.resolution ?? '1080p'
  );
  const [sound, setSound] = useState<boolean>(initialDecision?.sound ?? true);

  // Default prompts: usar el prompt de la última corrida (si lo hay), si no
  // el del initialDecision, si no el image_prompt de la escena.
  const [promptsByScene, setPromptsByScene] = useState<Map<number, string>>(
    () => {
      const m = new Map<number, string>();
      for (const s of eligibleScenes) {
        const fromPrev = previousByScene.get(s.scene_number)?.video_prompt;
        const fromInitial = initialDecision?.scenes.find(
          (x) => x.scene_number === s.scene_number
        )?.video_prompt;
        m.set(
          s.scene_number,
          fromPrev ?? fromInitial ?? s.image_prompt ?? ''
        );
      }
      return m;
    }
  );

  // Selección por defecto:
  //   - Hay previous con video_url exitoso → desmarcada (ya está hecha).
  //   - Hay previous con video_error o sin previous → marcada (a generar).
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(() => {
    const set = new Set<number>();
    for (const s of eligibleScenes) {
      const prev = previousByScene.get(s.scene_number);
      const alreadyDone = !!prev?.video_url && !prev.video_error;
      if (!alreadyDone) set.add(s.scene_number);
    }
    return set;
  });

  const [showCostDialog, setShowCostDialog] = useState(false);

  function togglePrompt(sceneNumber: number, value: string) {
    setPromptsByScene((prev) => {
      const next = new Map(prev);
      next.set(sceneNumber, value);
      return next;
    });
    // Si el prompt cambia respecto a la última corrida, marcar la escena
    // automáticamente — el resultado previo ya no es válido.
    const prevRun = previousByScene.get(sceneNumber);
    if (prevRun && value.trim() !== (prevRun.video_prompt ?? '').trim()) {
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
    selectedScenes.has(s.scene_number)
  );

  const allHavePrompts = includedScenes.every((s) => {
    const p = promptsByScene.get(s.scene_number) ?? '';
    return p.trim().length > 0;
  });

  const canSubmit = includedScenes.length > 0 && allHavePrompts;

  function handleSubmit() {
    if (!canSubmit) return;
    setShowCostDialog(true);
  }

  function handleConfirmCost() {
    setShowCostDialog(false);
    onConfirm({
      model,
      duration,
      resolution,
      sound,
      aspectRatio,
      scenes: includedScenes.map((s) => ({
        scene_number: s.scene_number,
        image_url: s.image_url!,
        video_prompt: (promptsByScene.get(s.scene_number) ?? '').trim(),
      })),
    });
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-yellow/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-800">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-pink" />
          Fase 4 — Revisión previa al video
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
          Revisá antes de generar los videos
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Cada video tarda 1–3 minutos y consume créditos de Replicate. Ajustá
          los prompts de movimiento de cámara antes de mandar el lote — luego
          se generan en serie.
        </p>
      </div>

      {/* Model selector */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Modelo
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModelCard
            id="kling-v3-omni"
            title="Kling v3 Omni"
            blurb="Identidad consistente (usa tus imágenes de referencia). Más caro y un poco más lento."
            tag={hasReferenceImages ? 'Recomendado' : 'Sin refs cargadas'}
            tagTone={hasReferenceImages ? 'pink' : 'neutral'}
            active={model === 'kling-v3-omni'}
            onClick={() => setModel('kling-v3-omni')}
          />
          <ModelCard
            id="kling-v3"
            title="Kling v3"
            blurb="Image-to-video directo. Más rápido y barato. No usa references."
            tag="Económico"
            tagTone="neutral"
            active={model === 'kling-v3'}
            onClick={() => setModel('kling-v3')}
          />
        </div>
      </div>

      {/* Global controls */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Parámetros globales
        </p>
        <div className="flex flex-wrap gap-6">
          <ControlGroup label="Duración">
            <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                    duration === d
                      ? 'bg-brand-pink text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup label="Resolución">
            <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
              {RESOLUTION_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                    resolution === r
                      ? 'bg-brand-pink text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup label="Sonido nativo">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-brand-pink focus:ring-brand-pink"
              />
              <span className="text-sm text-neutral-700">
                {sound ? 'Activado' : 'Desactivado'}
              </span>
            </label>
          </ControlGroup>
        </div>
      </div>

      {/* Scenes grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Escenas ({includedScenes.length} de {eligibleScenes.length})
          </h3>
          <p className="text-xs text-neutral-400">
            Desmarcá las que no querés convertir a video.
          </p>
        </div>

        {eligibleScenes.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Ninguna escena tiene imagen generada. Volvé al paso anterior.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eligibleScenes.map((scene) => {
              const isIncluded = selectedScenes.has(scene.scene_number);
              const prompt = promptsByScene.get(scene.scene_number) ?? '';
              const prev = previousByScene.get(scene.scene_number);
              const promptUnchanged =
                !!prev &&
                prompt.trim() === (prev.video_prompt ?? '').trim();
              const alreadyDone =
                !!prev?.video_url && !prev.video_error && promptUnchanged;
              return (
                <div
                  key={scene.scene_number}
                  className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
                    isIncluded
                      ? 'border-brand-pink/60'
                      : alreadyDone
                      ? 'border-emerald-300'
                      : 'border-neutral-200 opacity-60'
                  }`}
                >
                  <div className="relative aspect-[9/16] w-full bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={scene.image_url!}
                      alt={`Escena ${scene.scene_number}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-brand-pink px-2 py-0.5 text-xs font-bold text-white shadow">
                      #{scene.scene_number}
                    </span>
                    {alreadyDone && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        ✓ Video generado
                      </span>
                    )}
                    {prev?.video_error && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        ✗ Falló
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-xs font-semibold text-neutral-900">
                      {scene.scene_title}
                    </p>
                    <textarea
                      value={prompt}
                      onChange={(e) =>
                        togglePrompt(scene.scene_number, e.target.value)
                      }
                      rows={4}
                      placeholder="Describí movimiento de cámara y acción. Ej: 'slow dolly in, character turns head and smiles'"
                      className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 font-mono text-[11px] leading-snug text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
                    />
                    <label className="flex cursor-pointer items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => toggleSelected(scene.scene_number)}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-pink focus:ring-brand-pink"
                      />
                      <span className="text-xs text-neutral-700">
                        {alreadyDone
                          ? 'Regenerar (descartar el video actual)'
                          : 'Incluir en el video final'}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CostConfirmDialog
        open={showCostDialog}
        model={model}
        duration={duration}
        resolution={resolution}
        count={includedScenes.length}
        onConfirm={handleConfirmCost}
        onCancel={() => setShowCostDialog(false)}
      />

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 z-20 -mx-6 border-t border-neutral-200 bg-white/95 px-6 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
          >
            ← Volver a imágenes
          </button>
          <div className="flex items-center gap-3">
            <p className="text-xs text-neutral-500">
              {canSubmit
                ? `${includedScenes.length} video${includedScenes.length === 1 ? '' : 's'} · ${duration}s · ${resolution} · ${model}`
                : includedScenes.length === 0
                ? (previousResults?.length ?? 0) > 0
                  ? 'Todas las escenas tienen video. Editá un prompt o marcá manualmente para regenerar.'
                  : 'Seleccioná al menos una escena'
                : 'Completá los prompts de todas las escenas seleccionadas'}
            </p>
            <LoadingButton
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Generar los videos seleccionados"
              rightIcon={
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
              }
            >
              Generar {includedScenes.length} video
              {includedScenes.length === 1 ? '' : 's'}
            </LoadingButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelCard({
  title,
  blurb,
  tag,
  tagTone,
  active,
  onClick,
}: {
  id: string;
  title: string;
  blurb: string;
  tag: string;
  tagTone: 'pink' | 'neutral';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-pink ${
        active
          ? 'border-brand-pink bg-pink-50/40 shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-400'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-neutral-900">{title}</h4>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            tagTone === 'pink'
              ? 'bg-brand-pink text-white'
              : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {tag}
        </span>
      </div>
      <p className="text-xs text-neutral-600">{blurb}</p>
    </button>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      {children}
    </div>
  );
}
