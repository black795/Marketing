'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GenerateStoryResponse,
  Scene,
  VideoSceneOutput,
} from '@/types/story';
import type { EditPlan } from '@/types/edit-plan';
import { getEditPlan, saveEditPlan } from '@/lib/edit-plan-api';
import { buildTimeline } from '@/lib/captions-api';
import { EDITORS, getEditor } from '@/lib/editor-adapters';
import { getPreset } from '@/lib/editor-presets';
import { dlog, derror, dwarn } from '@/lib/debug-log';

import AssetGallery from './AssetGallery';
import EditConfigPanel from './EditConfigPanel';
import EditorPicker from './EditorPicker';
import EditorDynamicPanel from './EditorDynamicPanel';
import PreparationOverlay, { type PrepStep } from './PreparationOverlay';
import LoadingButton from '@/components/loading/LoadingButton';
import Spinner from '@/components/loading/Spinner';

interface AssetsHubPanelProps {
  result: GenerateStoryResponse;
  videoScenes: VideoSceneOutput[];
  onBackToVideo: () => void;
  onReset: () => void;
  onRegenerateImages: () => void;
  onRegenerateVideos: () => void;
}

/**
 * Fase "6 · Assets / Preparación".
 *
 * Es el hub de producción IA: galería de assets reales, configuración de
 * edición, selección de motor, panel dinámico por editor, resumen y
 * preparación. Persiste un `edit-plan.json` por proyecto con autosave.
 *
 * Cuando el usuario pulsa "Preparar y abrir editor", ejecuta una secuencia
 * REAL (validar → construir timeline → guardar plan → conectar) y navega
 * al editor elegido con el contexto del proyecto.
 */
export default function AssetsHubPanel({
  result,
  videoScenes,
  onBackToVideo,
  onReset,
  onRegenerateImages,
  onRegenerateVideos,
}: AssetsHubPanelProps) {
  const router = useRouter();

  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [planRecovered, setPlanRecovered] = useState(false);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );

  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepSteps, setPrepSteps] = useState<PrepStep[]>([]);

  // ---------- Carga inicial del plan ----------
  useEffect(() => {
    let cancelled = false;
    setLoadingPlan(true);
    getEditPlan(result.projectId)
      .then(({ plan: loaded, fresh }) => {
        if (cancelled) return;
        setPlan(loaded);
        setPlanRecovered(!fresh);
        dlog('hub', `plan ${fresh ? 'nuevo' : 'recuperado'}`, {
          editor: loaded.editorId,
          preset: loaded.presetId,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        derror('hub', 'no se pudo cargar el edit-plan', err);
        setPlan({
          projectId: result.projectId,
          editorId: 'captions',
          presetId: null,
          prompt: '',
          tags: [],
          includedScenes: [],
          sceneOrder: [],
          captionTemplateId: null,
          updatedAt: new Date().toISOString(),
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false);
      });
    return () => {
      cancelled = true;
    };
  }, [result.projectId]);

  // ---------- Autosave con debounce ----------
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlanRef = useRef<EditPlan | null>(null);
  lastPlanRef.current = plan;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavingState('saving');
    saveTimerRef.current = setTimeout(async () => {
      const current = lastPlanRef.current;
      if (!current) return;
      try {
        const saved = await saveEditPlan(current.projectId, current);
        // No reemplazamos el plan local con el del backend para no pisar
        // ediciones que estén en vuelo; solo confirmamos el guardado.
        setPlan((p) => (p ? { ...p, updatedAt: saved.updatedAt } : p));
        setSavingState('saved');
        dlog('hub', 'plan guardado');
        setTimeout(
          () =>
            setSavingState((s) => (s === 'saved' ? 'idle' : s)),
          1200
        );
      } catch (err) {
        setSavingState('error');
        dwarn('hub', 'autosave falló', err);
      }
    }, 700);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  type PlanPatch = Partial<EditPlan> & {
    suggestedEditor?: 'remotion' | 'captions';
  };

  const patchPlan = useCallback(
    (patch: PlanPatch) => {
      setPlan((p) => {
        if (!p) return p;
        const { suggestedEditor, ...rest } = patch;
        const next: EditPlan = { ...p, ...rest };
        // Si el preset trae un editor sugerido y el usuario no había
        // tocado uno distinto explícitamente, lo aplicamos.
        if (suggestedEditor) {
          next.editorId = suggestedEditor;
        }
        return next;
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  // ---------- Derivados ----------
  const includedSceneObjects: Scene[] = useMemo(() => {
    if (!plan) return result.scenes;
    if (plan.includedScenes.length === 0) return result.scenes;
    const set = new Set(plan.includedScenes);
    return result.scenes.filter((s) => set.has(s.scene_number));
  }, [plan, result.scenes]);

  const includedCount = includedSceneObjects.length;
  const totalCount = result.scenes.length;
  const videoCount = videoScenes.filter((v) => v.video_url).length;
  const editor = plan ? getEditor(plan.editorId) : null;
  const preset = plan ? getPreset(plan.presetId) : null;

  const canPrepare =
    !!plan && !!editor && editor.info.implemented && includedCount > 0 && !preparing;

  // ---------- Preparar y abrir editor ----------
  async function handlePrepareAndOpen() {
    if (!plan || !editor) return;
    setPreparing(true);
    setPrepError(null);

    const steps: PrepStep[] = [
      { id: 'validate', label: 'Validando assets…', status: 'pending' },
      { id: 'timeline', label: 'Generando timeline editable…', status: 'pending' },
      { id: 'save', label: 'Guardando plan de edición…', status: 'pending' },
      { id: 'open', label: 'Conectando editor…', status: 'pending' },
    ];
    setPrepSteps(steps);
    const mark = (id: string, status: PrepStep['status']) =>
      setPrepSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );

    try {
      // 1. Validate
      mark('validate', 'running');
      await sleep(250);
      if (includedSceneObjects.length === 0) {
        throw new Error('No hay escenas incluidas en la edición.');
      }
      if (!editor.info.implemented) {
        throw new Error(`El editor "${editor.info.label}" no está disponible aún.`);
      }
      mark('validate', 'done');

      // 2. Build timeline en orden custom (si lo hay) y solo con escenas incluidas.
      mark('timeline', 'running');
      const videoMap = new Map(videoScenes.map((v) => [v.scene_number, v]));
      const orderedNums =
        plan.sceneOrder.length > 0
          ? plan.sceneOrder.filter((n) =>
              includedSceneObjects.some((s) => s.scene_number === n)
            )
          : includedSceneObjects.map((s) => s.scene_number);
      const sceneByNumber = new Map(
        includedSceneObjects.map((s) => [s.scene_number, s])
      );
      const timelineScenes = orderedNums
        .map((n) => sceneByNumber.get(n))
        .filter((s): s is Scene => !!s)
        .map((s) => {
          const v = videoMap.get(s.scene_number);
          return {
            scene_number: s.scene_number,
            image_url: s.image_url ?? null,
            video_url: v?.video_url ?? null,
            local_url: v?.local_url ?? null,
            duration: s.duration,
            narration: s.narration,
          };
        });
      await buildTimeline({
        projectId: result.projectId,
        title: result.title,
        source: 'scripts',
        respectOrder: plan.sceneOrder.length > 0,
        scenes: timelineScenes,
      });
      mark('timeline', 'done');

      // 3. Flush del plan (por si hay un debounce pendiente).
      mark('save', 'running');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await saveEditPlan(plan.projectId, plan);
      mark('save', 'done');

      // 4. Conectar y abrir.
      mark('open', 'running');
      await sleep(300);
      mark('open', 'done');
      await sleep(150);
      router.push(editor.buildOpenHref(plan));
      // No reseteamos `preparing` aquí: la página se va a desmontar.
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error inesperado preparando el proyecto';
      derror('hub', `preparación fallida: ${msg}`, err);
      setPrepError(msg);
      // Marca el paso "running" actual como error.
      setPrepSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
      );
      setPreparing(true); // mantiene el overlay para que vea el error
    }
  }

  // ---------- Render ----------
  if (loadingPlan || !plan) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Spinner size={16} className="text-brand-pink" /> Cargando plan de edición…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-pink">
              6 · Assets / Preparación
            </p>
            <h2 className="truncate text-xl font-bold text-neutral-900">
              {result.title}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {includedCount === totalCount
                ? `${totalCount} escenas`
                : `${includedCount} de ${totalCount} escenas incluidas`}{' '}
              · {videoCount} videos · proyecto{' '}
              <code className="text-neutral-700">{result.projectId}</code>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SaveBadge state={savingState} recovered={planRecovered} />
            <button
              type="button"
              onClick={onBackToVideo}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
            >
              ← Volver a video
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-red-400 hover:text-red-600"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* 1. Galería */}
      <HubCard step={1} title="Galería de assets" hint="Reordena, incluye/excluye y regenera.">
        <AssetGallery
          scenes={result.scenes}
          videoScenes={videoScenes}
          includedScenes={plan.includedScenes}
          sceneOrder={plan.sceneOrder}
          onPatch={patchPlan}
          onRegenerateImages={onRegenerateImages}
          onRegenerateVideos={onRegenerateVideos}
          disabled={preparing}
        />
      </HubCard>

      {/* 2. Configuración de edición */}
      <HubCard step={2} title="Configuración de edición" hint="Estilo, prompt y tags.">
        <EditConfigPanel
          presetId={plan.presetId}
          prompt={plan.prompt}
          tags={plan.tags}
          onPatch={patchPlan}
          disabled={preparing}
        />
      </HubCard>

      {/* 3. Motor de edición */}
      <HubCard step={3} title="Motor de edición" hint="Elige qué sistema usar para editar.">
        <EditorPicker
          selectedId={plan.editorId}
          onSelect={(id) => patchPlan({ editorId: id })}
          disabled={preparing}
        />
      </HubCard>

      {/* 4. Configuración del editor (dinámica) */}
      <HubCard
        step={4}
        title={`Configuración · ${editor?.info.label ?? ''}`}
        hint="Opciones específicas del editor elegido."
      >
        <EditorDynamicPanel
          editorId={plan.editorId}
          captionTemplateId={plan.captionTemplateId}
          onPatch={patchPlan}
          disabled={preparing}
        />
      </HubCard>

      {/* 5. Resumen */}
      <HubCard step={5} title="Resumen" hint="Lo que se va a enviar al editor.">
        <SummaryGrid
          editor={editor?.info.label ?? '—'}
          editorEmoji={editor?.info.emoji ?? ''}
          presetLabel={preset?.label ?? 'libre'}
          included={includedCount}
          total={totalCount}
          videos={videoCount}
          tags={plan.tags}
          customOrder={plan.sceneOrder.length > 0}
        />
      </HubCard>

      {/* CTA */}
      <div className="sticky bottom-4 z-10 rounded-lg border border-neutral-200 bg-white/90 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {canPrepare
              ? `Listo para abrir ${editor?.info.label}.`
              : !editor?.info.implemented
              ? 'Elige un editor disponible para continuar.'
              : includedCount === 0
              ? 'Incluye al menos una escena en la galería.'
              : 'Completa la configuración para continuar.'}
          </p>
          <LoadingButton
            variant="primary"
            onClick={handlePrepareAndOpen}
            disabled={!canPrepare}
            loading={preparing && !prepError}
            loadingLabel="Preparando…"
          >
            🚀 Preparar y abrir editor →
          </LoadingButton>
        </div>
      </div>

      <PreparationOverlay
        open={preparing}
        steps={prepSteps}
        error={prepError}
        onClose={() => {
          setPreparing(false);
          setPrepError(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function HubCard({
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
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="text-xs text-neutral-500">{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function SaveBadge({
  state,
  recovered,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  recovered: boolean;
}) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-pink/10 px-2.5 py-1 text-[11px] font-semibold text-brand-pink">
        <Spinner size={10} className="text-brand-pink" /> Guardando…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        ✓ Guardado
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
        ✗ Error de guardado
      </span>
    );
  }
  if (recovered) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
        ↺ Plan recuperado
      </span>
    );
  }
  return null;
}

function SummaryGrid({
  editor,
  editorEmoji,
  presetLabel,
  included,
  total,
  videos,
  tags,
  customOrder,
}: {
  editor: string;
  editorEmoji: string;
  presetLabel: string;
  included: number;
  total: number;
  videos: number;
  tags: string[];
  customOrder: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCell label="Editor" value={`${editorEmoji} ${editor}`} />
      <SummaryCell label="Estilo" value={presetLabel} />
      <SummaryCell
        label="Escenas"
        value={included === total ? `${total}` : `${included} / ${total}`}
      />
      <SummaryCell label="Videos" value={`${videos}`} />
      <div className="col-span-2 sm:col-span-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          Tags · {customOrder ? 'orden custom' : 'orden natural'}
        </p>
        {tags.length === 0 ? (
          <p className="text-xs text-neutral-400">— sin tags —</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-brand-yellow/40 px-2 py-0.5 text-[10px] font-semibold text-neutral-800"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-neutral-800">
        {value}
      </p>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
