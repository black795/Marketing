'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PromptForm, { type PromptContext } from '@/components/PromptForm';
import ProjectHeader from '@/components/ProjectHeader';
import ScenesGrid from '@/components/ScenesGrid';
import SceneEditPanel from '@/components/SceneEditPanel';
import CompareDialog, {
  type CompareDecision,
} from '@/components/CompareDialog';
import TimelineStrip from '@/components/TimelineStrip';
import RegenerateToolbar from '@/components/RegenerateToolbar';
import ScriptReviewPanel from '@/components/ScriptReviewPanel';
import LoadingButton from '@/components/loading/LoadingButton';
import ProgressBar from '@/components/loading/ProgressBar';
import Spinner from '@/components/loading/Spinner';
import type { SceneStreamStatus } from '@/components/SceneCard';
import VideoReviewPanel, {
  type VideoGenerationDecision,
} from '@/components/VideoReviewPanel';
import {
  generateScript,
  regenerateSingleScene,
  streamGenerateImagesFromScript,
  streamGenerateVideosFromScenes,
  streamRegenerateImages,
  StreamCancelledError,
} from '@/lib/api';
import { buildTimeline } from '@/lib/captions-api';
import AssetsHubPanel from '@/components/assets-hub/AssetsHubPanel';
import {
  DEFAULT_SETTINGS,
  type GenerationSettings,
} from '@/lib/generation-settings';
import {
  type AdvancedEdit,
  type SceneVersion,
  makeRequestId,
  versionFromScene,
} from '@/lib/scene-history';
import type {
  GenerateScriptResponse,
  GenerateStoryResponse,
  Scene,
  VideoSceneOutput,
} from '@/types/story';

type Phase =
  | 'idle'
  | 'generating-script'
  | 'script-review'
  | 'generating-images'
  | 'result'
  | 'video-review'
  | 'generating-videos'
  | 'video-result'
  | 'preparing-assets';

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

  // ---------- Estado de video (fase 4) ----------
  const [videoDecision, setVideoDecision] =
    useState<VideoGenerationDecision | null>(null);
  const [videoScenes, setVideoScenes] = useState<VideoSceneOutput[]>([]);
  const [videoStatusByNumber, setVideoStatusByNumber] = useState<
    Map<number, SceneStreamStatus>
  >(() => new Map());
  const [videoStreamProgress, setVideoStreamProgress] =
    useState<StreamProgress | null>(null);
  const [videoStreamWarning, setVideoStreamWarning] = useState<string | null>(
    null
  );
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoStreamAbortRef = useRef<AbortController | null>(null);

  // ---------- Salto al editor (paso siguiente a video-result) ----------
  // Construye el timeline.json del proyecto a partir de las escenas + videos
  // y navega a /editor?projectId=... para que ambos editores ya lo tengan.
  const router = useRouter();
  const [continuingToEditor, setContinuingToEditor] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  // ---------- Edición avanzada por escena ----------
  const [historyByScene, setHistoryByScene] = useState<
    Map<number, SceneVersion[]>
  >(() => new Map());

  /**
   * Máquina de estados de la regeneración de una sola escena:
   *
   *    idle ──start──▶ running ──cancel──▶ cancelling ──settle──▶ idle
   *                       │
   *                       └────────settle──▶ idle  (done/error)
   *
   * Garantías:
   *   - El abort siempre se hace sobre el AbortController guardado en el
   *     mismo objeto de estado (sin refs sueltas).
   *   - Cada arranque genera un requestId nuevo. Las settles tardías de
   *     requests anteriores no pueden contaminar el estado actual.
   *   - Iniciar una nueva regen sin esperar el cleanup anterior es legal:
   *     aborta lo viejo y arranca limpio.
   */
  type SingleRegenState =
    | { kind: 'idle' }
    | {
        kind: 'running';
        sceneNumber: number;
        requestId: string;
        message: string;
        startedAt: number;
        abort: AbortController;
      }
    | {
        kind: 'cancelling';
        sceneNumber: number;
        requestId: string;
        startedAt: number;
      };

  const [regenState, setRegenState] = useState<SingleRegenState>({
    kind: 'idle',
  });
  const regenStateRef = useRef(regenState);
  useEffect(() => {
    regenStateRef.current = regenState;
  }, [regenState]);

  const [singleRegenError, setSingleRegenError] = useState<string | null>(null);

  interface PendingCompare {
    sceneNumber: number;
    originalScene: Scene;
    newScene: Scene; // contiene image_url o image_error
    finalPrompt: string;
    edit: AdvancedEdit;
    requestId: string;
  }
  const [pendingCompare, setPendingCompare] =
    useState<PendingCompare | null>(null);

  // ---------- Reset ----------
  function handleReset() {
    streamAbortRef.current?.abort();
    regenAbortRef.current?.abort();
    videoStreamAbortRef.current?.abort();
    abortCurrentSingleRegen('reset');
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
    setHistoryByScene(new Map());
    setRegenState({ kind: 'idle' });
    setSingleRegenError(null);
    setPendingCompare(null);
    setVideoDecision(null);
    setVideoScenes([]);
    setVideoStatusByNumber(new Map());
    setVideoStreamProgress(null);
    setVideoStreamWarning(null);
    setVideoError(null);
  }

  /** Aborta el regen single en curso (si lo hay). Sincrónico. */
  function abortCurrentSingleRegen(reason: string) {
    const curr = regenStateRef.current;
    if (curr.kind === 'running') {
      console.log('[regen] abort', {
        requestId: curr.requestId,
        sceneNumber: curr.sceneNumber,
        reason,
        elapsedMs: Date.now() - curr.startedAt,
      });
      try {
        curr.abort.abort();
      } catch {
        /* ignore */
      }
    }
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

      // Siembra el historial con la versión inicial por escena.
      setHistoryByScene(() => {
        const map = new Map<number, SceneVersion[]>();
        for (const s of finalScenes) {
          if (s.image_url) {
            map.set(s.scene_number, [versionFromScene(s, 'initial')]);
          }
        }
        return map;
      });

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

  // ---------- Fase 4 → 5: video ----------
  function handleContinueToVideoReview() {
    if (!result) return;
    setVideoError(null);
    setVideoStreamWarning(null);
    setPhase('video-review');
  }

  function handleBackToImages() {
    setPhase('result');
  }

  async function handleStartVideoGeneration(decision: VideoGenerationDecision) {
    if (!result) return;
    setVideoError(null);
    setVideoStreamWarning(null);

    // Consolidar decision con la previa: las escenas que NO están en este run
    // se mantienen (para que cuando el usuario vuelva a video-review, las
    // recuerde correctamente).
    const newSceneNumbers = new Set(decision.scenes.map((s) => s.scene_number));
    const mergedDecisionScenes = [
      ...(videoDecision?.scenes ?? []).filter(
        (s) => !newSceneNumbers.has(s.scene_number)
      ),
      ...decision.scenes,
    ].sort((a, b) => a.scene_number - b.scene_number);
    const consolidatedDecision: VideoGenerationDecision = {
      ...decision,
      scenes: mergedDecisionScenes,
    };
    setVideoDecision(consolidatedDecision);

    // Seed videoScenes: placeholders sólo para las que se van a generar.
    // Las del videoScenes previo que NO se regeneran se preservan tal cual
    // (con su video_url, local_url y posible video_error).
    const placeholders: VideoSceneOutput[] = decision.scenes.map((s) => ({
      scene_number: s.scene_number,
      image_url: s.image_url,
      video_prompt: s.video_prompt,
      video_url: null,
    }));
    const keptFromPrevious = videoScenes.filter(
      (s) => !newSceneNumbers.has(s.scene_number)
    );
    const initial: VideoSceneOutput[] = [...keptFromPrevious, ...placeholders].sort(
      (a, b) => a.scene_number - b.scene_number
    );
    setVideoScenes(initial);

    const initialStatus = new Map<number, SceneStreamStatus>();
    for (const s of initial) {
      if (newSceneNumbers.has(s.scene_number)) {
        initialStatus.set(s.scene_number, 'pending');
      } else {
        initialStatus.set(s.scene_number, s.video_url ? 'done' : 'error');
      }
    }
    setVideoStatusByNumber(initialStatus);

    setVideoStreamProgress({
      total: decision.scenes.length,
      completed: 0,
      currentSceneNumber: null,
      message: 'Conectando con el worker…',
    });

    setPhase('generating-videos');

    const abort = new AbortController();
    videoStreamAbortRef.current = abort;

    try {
      const refDataUrls =
        decision.model === 'kling-v3-omni'
          ? promptCtx?.referenceImages.map((r) => r.dataUrl) ?? []
          : [];

      const outcome = await streamGenerateVideosFromScenes(
        {
          model: decision.model,
          projectId: result.projectId,
          duration: decision.duration,
          resolution: decision.resolution,
          sound: decision.sound,
          aspectRatio: decision.aspectRatio,
          scenes: decision.scenes,
          referenceImageUrls:
            refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onStart: ({ total }) => {
            setVideoStreamProgress({
              total,
              completed: 0,
              currentSceneNumber: null,
              message: 'Encolando videos…',
            });
          },
          onSceneStart: ({ scene_number, index, total }) => {
            setVideoStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(scene_number, 'active');
              return next;
            });
            setVideoStreamProgress({
              total,
              completed: index,
              currentSceneNumber: scene_number,
              message: `Generando video ${index + 1}/${total} (escena ${scene_number})…`,
            });
          },
          onScene: ({ scene, index, total }) => {
            setVideoScenes((prev) => {
              const idx = prev.findIndex(
                (s) => s.scene_number === scene.scene_number
              );
              if (idx < 0) return [...prev, scene];
              const next = prev.slice();
              next[idx] = scene;
              return next;
            });
            setVideoStatusByNumber((prev) => {
              const next = new Map(prev);
              next.set(
                scene.scene_number,
                scene.video_url ? 'done' : 'error'
              );
              return next;
            });
            setVideoStreamProgress({
              total,
              completed: index,
              currentSceneNumber: null,
              message:
                index === total
                  ? 'Finalizando…'
                  : `Video ${index}/${total} listo`,
            });
          },
          onWarning: (msg) => setVideoStreamWarning(msg),
        },
        abort.signal
      );

      if (outcome.status === 'cancelled') {
        setVideoError('Generación de videos cancelada.');
        setPhase('video-review');
      } else {
        setPhase('video-result');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setVideoError('Generación de videos cancelada.');
      } else {
        setVideoError(
          err instanceof Error
            ? err.message
            : 'No se pudieron generar los videos'
        );
      }
      setPhase('video-review');
    } finally {
      videoStreamAbortRef.current = null;
      setVideoStreamProgress(null);
    }
  }

  function handleCancelVideoStream() {
    videoStreamAbortRef.current?.abort();
    setVideoStreamProgress((p) =>
      p ? { ...p, message: 'Cancelando…' } : p
    );
  }

  function handleBackToVideoReview() {
    setPhase('video-review');
  }

  /**
   * Reintentar UNA sola escena (botón en la card cuando hay video_error).
   * Reusa el flujo de streaming con scenes=[esa] y el merge en
   * handleStartVideoGeneration preserva las demás.
   */
  async function handleRetryScene(sceneNumber: number) {
    if (!videoDecision) return;
    const sceneOut = videoScenes.find((s) => s.scene_number === sceneNumber);
    if (!sceneOut?.image_url) return;
    const retryDecision: VideoGenerationDecision = {
      ...videoDecision,
      scenes: [
        {
          scene_number: sceneNumber,
          image_url: sceneOut.image_url,
          video_prompt: sceneOut.video_prompt,
        },
      ],
    };
    await handleStartVideoGeneration(retryDecision);
  }

  /**
   * Pasa de "video-result" a la fase 6 (Hub de Assets / Preparación).
   * El Hub es el que construye el timeline final y abre el editor — antes
   * esta función lo hacía directo, ahora hay una capa de preparación.
   */
  async function handleContinueToEditor() {
    if (!result) return;
    setContinueError(null);
    setContinuingToEditor(false);
    setPhase('preparing-assets');
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
            let updatedScene: Scene | null = null;
            setResult((prev) => {
              if (!prev) return prev;
              const updatedScenes = prev.scenes.map((scene) => {
                if (scene.scene_number !== r.scene_number) return scene;
                const { image_error: _ignored, ...rest } = scene;
                const next: Scene = {
                  ...rest,
                  image_url: r.image_url,
                  ...(r.image_error ? { image_error: r.image_error } : {}),
                };
                updatedScene = next;
                return next;
              });
              return { ...prev, scenes: updatedScenes };
            });
            if (updatedScene && r.image_url) {
              pushHistoryVersion(r.scene_number, updatedScene, 'edit');
            }
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

  // ---------- Edición avanzada: helpers ----------
  function pushHistoryVersion(
    sceneNumber: number,
    scene: Scene,
    source: SceneVersion['source'],
    label?: string
  ) {
    setHistoryByScene((prev) => {
      const next = new Map(prev);
      const existing = next.get(sceneNumber) ?? [];
      const newVersion = versionFromScene(scene, source, label);
      next.set(sceneNumber, [...existing, newVersion]);
      console.log('[history] version pushed', {
        sceneNumber,
        source,
        label,
        totalVersions: existing.length + 1,
        hasImage: !!scene.image_url,
      });
      return next;
    });
  }

  function applySceneUpdate(sceneNumber: number, patch: Partial<Scene>): Scene | null {
    let updated: Scene | null = null;
    setResult((prev) => {
      if (!prev) return prev;
      const scenes = prev.scenes.map((s) => {
        if (s.scene_number !== sceneNumber) return s;
        const { image_error: _ignored, ...rest } = s;
        const next: Scene = { ...rest, ...patch };
        updated = next;
        return next;
      });
      return { ...prev, scenes };
    });
    if (updated && selectedScene?.scene_number === sceneNumber) {
      setSelectedScene(updated);
    }
    return updated;
  }

  // ---------- Edición avanzada: regenerar una sola escena ----------
  async function handleRegenerateSingle({
    sceneNumber,
    finalPrompt,
    edit,
  }: {
    sceneNumber: number;
    finalPrompt: string;
    edit: AdvancedEdit;
  }) {
    if (!result) return;
    const original = result.scenes.find((s) => s.scene_number === sceneNumber);
    if (!original) return;

    // Si hay otra regen en curso (running/cancelling), la abortamos para
    // que esta nueva petición no se quede esperando una settle ajena.
    const prior = regenStateRef.current;
    if (prior.kind === 'running') {
      console.log('[regen] restarted — aborting prior', {
        priorRequestId: prior.requestId,
        elapsedMs: Date.now() - prior.startedAt,
      });
      try {
        prior.abort.abort();
      } catch {
        /* ignore */
      }
    }

    const requestId = makeRequestId();
    const abort = new AbortController();
    const startedAt = Date.now();

    console.log('[regen] generation started', {
      requestId,
      sceneNumber,
      promptLen: finalPrompt.length,
    });

    setSingleRegenError(null);
    setRegenState({
      kind: 'running',
      sceneNumber,
      requestId,
      message: 'Conectando…',
      startedAt,
      abort,
    });

    // Helper: sólo aplica una settle si el requestId sigue siendo el actual.
    const settle = (next: SingleRegenState) => {
      setRegenState((curr) => {
        if (curr.kind === 'idle') return curr;
        if ('requestId' in curr && curr.requestId !== requestId) return curr;
        return next;
      });
    };

    try {
      const refDataUrls = promptCtx?.referenceImages.map((r) => r.dataUrl) ?? [];
      const r = await regenerateSingleScene(
        {
          model: result.model,
          scene_number: sceneNumber,
          image_prompt: finalPrompt,
          quality: settings.quality,
          aspectRatio: settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onProgress: (m) => {
            setRegenState((curr) => {
              if (curr.kind === 'running' && curr.requestId === requestId) {
                return { ...curr, message: m };
              }
              return curr;
            });
          },
        },
        abort.signal
      );

      console.log('[regen] generation completed', {
        requestId,
        sceneNumber,
        elapsedMs: Date.now() - startedAt,
        hasImage: !!r.image_url,
      });

      // Construyo la "nueva" Scene (no la persisto aún — espera decisión
      // del usuario). Guardo edit.prompt como base — los overrides se
      // recomponen cuando el usuario re-genere desde el edit panel.
      const newScene: Scene = {
        ...original,
        camera: edit.camera || original.camera,
        lighting: edit.lighting || original.lighting,
        emotion: edit.emotion || original.emotion,
        image_prompt: edit.prompt,
        image_url: r.image_url,
        ...(r.image_error ? { image_error: r.image_error } : {}),
      };

      setPendingCompare({
        sceneNumber,
        originalScene: original,
        newScene,
        finalPrompt,
        edit,
        requestId,
      });
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        console.log('[regen] generation cancelled', {
          requestId,
          sceneNumber,
          elapsedMs: Date.now() - startedAt,
        });
        setSingleRegenError('Generación cancelada.');
      } else {
        console.error('[regen] generation failed', {
          requestId,
          sceneNumber,
          elapsedMs: Date.now() - startedAt,
          err,
        });
        setSingleRegenError(
          err instanceof Error ? err.message : 'Error al regenerar la escena'
        );
      }
    } finally {
      // Sólo vuelvo a idle si seguimos siendo el "owner" del estado.
      // Si una nueva regen ya tomó el control, no la pisamos.
      settle({ kind: 'idle' });
    }
  }

  function handleCancelSingleRegen() {
    const curr = regenStateRef.current;
    if (curr.kind !== 'running') return;
    console.log('[regen] cancel requested', {
      requestId: curr.requestId,
      sceneNumber: curr.sceneNumber,
      elapsedMs: Date.now() - curr.startedAt,
    });
    try {
      curr.abort.abort();
    } catch {
      /* ignore */
    }
    setRegenState({
      kind: 'cancelling',
      sceneNumber: curr.sceneNumber,
      requestId: curr.requestId,
      startedAt: curr.startedAt,
    });
  }

  function handleCompareDecision(decision: CompareDecision) {
    if (!pendingCompare) return;
    const { sceneNumber, originalScene, newScene, requestId } = pendingCompare;

    console.log('[compare] decision', {
      requestId,
      sceneNumber,
      decision,
      hadNewImage: !!newScene.image_url,
    });

    if (decision === 'keep') {
      // No tocar la escena. Sólo cerrar.
      setPendingCompare(null);
      return;
    }

    if (decision === 'both') {
      // Guarda la nueva en el historial pero mantiene la original como actual.
      if (newScene.image_url) {
        pushHistoryVersion(
          sceneNumber,
          newScene,
          'edit',
          'guardada sin reemplazar'
        );
      }
      setPendingCompare(null);
      return;
    }

    // 'replace' → la original cae al historial (si no estaba ya como v1),
    // la nueva pasa a ser la actual y se agrega al historial.
    const history = historyByScene.get(sceneNumber) ?? [];
    const originalAlreadyInHistory = history.some(
      (v) => v.image_url === originalScene.image_url
    );
    if (!originalAlreadyInHistory && originalScene.image_url) {
      pushHistoryVersion(sceneNumber, originalScene, 'initial');
    }

    const updated = applySceneUpdate(sceneNumber, {
      image_url: newScene.image_url,
      image_prompt: newScene.image_prompt,
      camera: newScene.camera,
      lighting: newScene.lighting,
      emotion: newScene.emotion,
      ...(newScene.image_error ? { image_error: newScene.image_error } : {}),
    });
    if (updated && updated.image_url) {
      pushHistoryVersion(sceneNumber, updated, 'edit');
      console.log('[scene] preview updated → new image active', {
        sceneNumber,
        requestId,
      });
    }
    setPendingCompare(null);
  }

  function handleRestoreVersion(sceneNumber: number, versionId: string) {
    const history = historyByScene.get(sceneNumber) ?? [];
    const v = history.find((x) => x.id === versionId);
    if (!v || !v.image_url) return;
    const updated = applySceneUpdate(sceneNumber, {
      image_url: v.image_url,
      image_prompt: v.image_prompt,
      camera: v.camera,
      lighting: v.lighting,
      emotion: v.emotion,
    });
    if (updated) {
      pushHistoryVersion(sceneNumber, updated, 'restore', `restaurada`);
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
              onContinueToVideo={handleContinueToVideoReview}
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

        {phase === 'video-review' && result && (
          <VideoReviewPanel
            scenes={result.scenes}
            hasReferenceImages={
              (promptCtx?.referenceImages.length ?? 0) > 0
            }
            aspectRatio={settings.aspectRatio}
            initialDecision={videoDecision}
            previousResults={videoScenes}
            onBack={handleBackToImages}
            onConfirm={handleStartVideoGeneration}
          />
        )}

        {phase === 'generating-videos' && (
          <div className="space-y-6">
            <StreamingProgressCard
              progress={videoStreamProgress}
              warning={videoStreamWarning}
              onCancel={handleCancelVideoStream}
              title="Generando videos en serie"
              fallbackMessage="Generando videos…"
            />
            <VideoStreamGrid
              scenes={videoScenes}
              statusByNumber={videoStatusByNumber}
            />
          </div>
        )}

        {phase === 'video-result' && (
          <VideoResultView
            scenes={videoScenes}
            error={videoError}
            onBackToReview={handleBackToVideoReview}
            onReset={handleReset}
            onRetryScene={handleRetryScene}
            onContinueToEditor={handleContinueToEditor}
            continuingToEditor={continuingToEditor}
            continueError={continueError}
          />
        )}

        {phase === 'preparing-assets' && result && (
          <AssetsHubPanel
            result={result}
            videoScenes={videoScenes}
            onBackToVideo={() => setPhase('video-result')}
            onReset={handleReset}
            onRegenerateImages={() => setPhase('result')}
            onRegenerateVideos={() => setPhase('video-review')}
          />
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

      <SceneEditPanel
        scene={selectedScene}
        history={
          selectedScene
            ? historyByScene.get(selectedScene.scene_number) ?? []
            : []
        }
        regenerating={
          selectedScene !== null &&
          regenState.kind !== 'idle' &&
          regenState.sceneNumber === selectedScene.scene_number
        }
        regenStatus={
          regenState.kind === 'running'
            ? regenState.message
            : regenState.kind === 'cancelling'
            ? 'Cancelando…'
            : ''
        }
        regenError={singleRegenError}
        cancelling={regenState.kind === 'cancelling'}
        onClose={() => {
          // Permitir cerrar incluso si una regen quedó en cancelling/error.
          if (regenState.kind === 'running') {
            // Mejor abortar y cerrar a dejar la UI bloqueada.
            abortCurrentSingleRegen('user-close');
          }
          setSelectedScene(null);
          setSingleRegenError(null);
        }}
        onRegenerate={handleRegenerateSingle}
        onCancelRegenerate={handleCancelSingleRegen}
        onRestoreVersion={handleRestoreVersion}
      />

      <CompareDialog
        open={pendingCompare !== null}
        title={
          pendingCompare
            ? `Comparar escena #${pendingCompare.sceneNumber}`
            : 'Comparar versiones'
        }
        originalUrl={pendingCompare?.originalScene.image_url ?? null}
        originalLabel="Actual"
        newUrl={pendingCompare?.newScene.image_url ?? null}
        newLabel="Nueva"
        newError={pendingCompare?.newScene.image_error}
        promptDiff={
          pendingCompare
            ? {
                before: pendingCompare.originalScene.image_prompt,
                after: pendingCompare.finalPrompt,
              }
            : undefined
        }
        onClose={() => setPendingCompare(null)}
        onDecide={handleCompareDecision}
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
    { key: 'video-review', label: '4 · Revisar' },
    { key: ['generating-videos', 'video-result'], label: '5 · Video' },
    { key: 'preparing-assets', label: '6 · Assets' },
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
  title = 'Generando imágenes en tiempo real',
  fallbackMessage = 'Generando imágenes…',
}: {
  progress: StreamProgress | null;
  warning: string | null;
  onCancel: () => void;
  title?: string;
  fallbackMessage?: string;
}) {
  const value =
    progress && progress.total > 0
      ? progress.completed / progress.total
      : null;
  const message = progress?.message ?? fallbackMessage;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Spinner size={18} className="text-brand-pink" />
            <p className="text-sm font-semibold text-neutral-800">
              {title}
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

function VideoStreamGrid({
  scenes,
  statusByNumber,
}: {
  scenes: VideoSceneOutput[];
  statusByNumber: Map<number, SceneStreamStatus>;
}) {
  if (scenes.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Videos en vivo
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => {
          const status = statusByNumber.get(s.scene_number) ?? 'pending';
          return (
            <div
              key={s.scene_number}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[9/16] w-full bg-neutral-100">
                {s.video_url || s.local_url ? (
                  <video
                    src={s.local_url || s.video_url!}
                    controls
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : s.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image_url}
                      alt={`Escena ${s.scene_number} (frame inicial)`}
                      className="h-full w-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {status === 'active' && (
                        <Spinner size={28} className="text-brand-pink" />
                      )}
                      {status === 'error' && (
                        <span className="rounded bg-red-600/90 px-2 py-1 text-xs font-semibold text-white">
                          Falló
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    Sin imagen
                  </div>
                )}
                <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-brand-pink px-2 py-0.5 text-xs font-bold text-white shadow">
                  #{s.scene_number}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs text-neutral-600">
                  {s.video_prompt}
                </p>
                {s.video_error && (
                  <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    {s.video_error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VideoResultView({
  scenes,
  error,
  onBackToReview,
  onReset,
  onRetryScene,
  onContinueToEditor,
  continuingToEditor,
  continueError,
}: {
  scenes: VideoSceneOutput[];
  error: string | null;
  onBackToReview: () => void;
  onReset: () => void;
  onRetryScene: (sceneNumber: number) => void;
  onContinueToEditor: () => void;
  continuingToEditor: boolean;
  continueError: string | null;
}) {
  const success = scenes.filter((s) => s.video_url);
  const failed = scenes.filter((s) => !s.video_url);

  function preferredUrl(s: VideoSceneOutput): string | null {
    // Preferimos local_url (sobrevive la expiración de Replicate).
    return s.local_url || s.video_url || null;
  }

  function downloadAll() {
    success.forEach((s, idx) => {
      const url = preferredUrl(s);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene_${String(s.scene_number).padStart(2, '0')}.mp4`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      // Pequeño escalonado para evitar bloqueos del browser.
      setTimeout(() => {
        a.click();
        a.remove();
      }, idx * 250);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              Videos generados
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {success.length} de {scenes.length} listos
              {failed.length > 0 ? ` · ${failed.length} fallidos` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBackToReview}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
            >
              ← Volver a editar
            </button>
            <LoadingButton
              variant="primary"
              onClick={onContinueToEditor}
              loading={continuingToEditor}
              loadingLabel="Cargando…"
              disabled={success.length === 0}
              aria-label="Continuar a la fase de preparación (Assets Hub)"
              title="Abre el Hub de Assets para configurar la edición antes del editor"
            >
              📦 Continuar a preparación →
            </LoadingButton>
            <LoadingButton
              variant="secondary"
              onClick={downloadAll}
              disabled={success.length === 0}
              aria-label="Descargar todos los videos"
            >
              Descargar todos
            </LoadingButton>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-red-400 hover:text-red-600"
            >
              Empezar de cero
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {continueError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo continuar al editor: {continueError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => {
          const playUrl = preferredUrl(s);
          return (
            <div
              key={s.scene_number}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[9/16] w-full bg-neutral-900">
                {playUrl ? (
                  <video
                    src={playUrl}
                    controls
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : s.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image_url}
                      alt={`Escena ${s.scene_number}`}
                      className="h-full w-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded bg-red-600/90 px-2 py-1 text-xs font-semibold text-white">
                        Sin video
                      </span>
                    </div>
                  </>
                ) : null}
                <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-brand-pink px-2 py-0.5 text-xs font-bold text-white shadow">
                  #{s.scene_number}
                </span>
                {s.local_url && (
                  <span
                    title="Servido desde el backend local — no expira"
                    className="absolute right-2 top-2 inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow"
                  >
                    ✓ Local
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-xs text-neutral-600">
                  {s.video_prompt}
                </p>
                {playUrl ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={playUrl}
                      download={`scene_${String(s.scene_number).padStart(2, '0')}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-pink hover:underline"
                    >
                      ↓ Descargar
                    </a>
                    {s.video_url && s.local_url && s.video_url !== s.local_url && (
                      <a
                        href={s.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-neutral-400 hover:text-neutral-600"
                      >
                        (origen Replicate)
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {s.video_error && (
                      <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                        {s.video_error}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => onRetryScene(s.scene_number)}
                      className="inline-flex items-center gap-1 rounded-md border border-brand-pink bg-white px-2 py-1 text-xs font-semibold text-brand-pink hover:bg-pink-50"
                    >
                      ↻ Reintentar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
