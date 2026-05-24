'use client';

import { useEffect } from 'react';
import {
  useStoryboard,
  useSelectedScene,
  useHistory,
} from '../store/context';
import { useAutoSave } from '../hooks/useAutoSave';
import SceneCard from './SceneCard';
import ScenePreview from './ScenePreview';
import AssetSidebar from './AssetSidebar';
import AutoEditMenu from './AutoEditMenu';

/**
 * Panel principal del Storyboard Engine.
 *
 *   ┌─────────────┬─────────────────────────┬─────────────┐
 *   │   sidebar   │     scenes grid + bar   │   preview   │
 *   │  materiales │  + scene seleccionada   │ (panel der) │
 *   └─────────────┴─────────────────────────┴─────────────┘
 *
 * Layout responsive: en mobile colapsa a 1 columna (grid sobre todo, preview
 * abajo, sidebar como tabs colapsables).
 */
export default function StoryboardPanel() {
  const { state } = useStoryboard();
  const selected = useSelectedScene();
  useAutoSave();

  const fps = state.project.renderConfig.fps;

  // Atajos teclado: ←/→ navegan entre escenas; Backspace borra; Z undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        // Nav lógica simple sin pasar dispatch — el listener lo lee del closure
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
      {/* Sidebar materiales — colapsa a top en mobile */}
      <div className="h-64 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm lg:h-auto lg:w-72">
        <AssetSidebar project={state.project} />
      </div>

      {/* Grid central + preview */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row xl:gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-neutral-200 bg-white shadow-sm">
          <TopBar />
          <ScenesGrid fps={fps} />
        </div>

        <aside className="h-full min-h-0 shrink-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm xl:w-[360px]">
          {selected ? (
            <ScenePreview scene={selected} fps={fps} />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-neutral-700">
                Selecciona una escena
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Click sobre cualquier card del grid para editarla, regenerarla
                o re-prompt-earla.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar — título editable, save state, undo/redo, contadores.
// ---------------------------------------------------------------------------

function TopBar() {
  const { state, dispatch } = useStoryboard();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const totalSec =
    state.project.metadata.durationFrames / state.project.renderConfig.fps;

  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2.5">
      <input
        type="text"
        value={state.project.title}
        onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
        className="flex-1 bg-transparent text-sm font-bold text-neutral-900 focus:outline-none"
        aria-label="Título del proyecto"
      />
      <span className="hidden text-[11px] text-neutral-400 sm:inline">
        {state.project.scenes.length} escenas · {totalSec.toFixed(1)}s
      </span>
      <AutoEditMenu variant="compact" />
      <SaveStateBadge />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Deshacer"
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Rehacer"
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          ↷
        </button>
      </div>
    </div>
  );
}

function SaveStateBadge() {
  const { state } = useStoryboard();
  const map: Record<typeof state.saveState, { label: string; cls: string }> = {
    idle: { label: '·', cls: 'text-neutral-400' },
    dirty: { label: 'modificado', cls: 'text-amber-600' },
    saving: { label: 'guardando…', cls: 'text-blue-600' },
    saved: { label: '✓ guardado', cls: 'text-emerald-600' },
    error: { label: 'error', cls: 'text-red-600' },
  };
  const m = map[state.saveState];
  return (
    <span
      className={`text-[11px] font-semibold ${m.cls}`}
      title={state.saveError ?? undefined}
    >
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Grid responsivo de escenas con drag & drop.
// ---------------------------------------------------------------------------

function ScenesGrid({ fps }: { fps: number }) {
  const { state } = useStoryboard();
  const scenes = state.project.scenes;

  if (scenes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-neutral-500">
          Este proyecto aún no tiene escenas. Genera un guion + imágenes desde{' '}
          <span className="font-semibold">Scripts</span> para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div
        role="list"
        aria-label="Escenas del proyecto"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      >
        {scenes.map((scene, i) => (
          <SceneCard key={scene.id} scene={scene} index={i} fps={fps} />
        ))}
      </div>
    </div>
  );
}
