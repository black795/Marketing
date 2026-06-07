'use client';

import { useStoryboard } from '@/storyboard';
import { TOOLS } from '../types/tools';
import { useTimelineUi } from '../store/context';
import { useZoom } from '../hooks/useZoom';

/**
 * Toolbar — herramientas + zoom + snap + acciones bulk (duplicate / split /
 * ripple-delete) según selección.
 */
export default function TimelineToolbar() {
  const { state: sb, dispatch: dispatchSb } = useStoryboard();
  const { ui, dispatchUi } = useTimelineUi();
  const { pxPerFrame, zoomIn, zoomOut } = useZoom();

  const selCount = ui.selection.length;
  const canDuplicate = selCount === 1;
  const canSplit = selCount === 1;
  const canDelete = selCount > 0;

  return (
    <div className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5">
      {/* Herramientas */}
      <div className="flex gap-0.5">
        {TOOLS.map((t) => {
          const active = ui.tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => dispatchUi({ type: 'SET_TOOL', tool: t.id })}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition ${
                active
                  ? 'bg-[var(--blue)] text-white shadow-sm'
                  : 'text-[var(--fg-2)] hover:bg-[var(--bg-3)]'
              }`}
              title={`${t.description} (${t.shortcut})`}
            >
              <span>{t.emoji}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-1 h-5 w-px bg-[var(--bg-3)]" aria-hidden />

      {/* Acciones bulk */}
      <button
        type="button"
        disabled={!canDuplicate}
        onClick={() => dispatchSb({ type: 'DUPLICATE_SCENE', sceneId: ui.selection[0] })}
        className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] disabled:opacity-40"
        title="Duplicar (Ctrl+D)"
      >
        Duplicar
      </button>
      <button
        type="button"
        disabled={!canSplit}
        onClick={() =>
          dispatchSb({
            type: 'SPLIT_SCENE',
            sceneId: ui.selection[0],
            atFrameAbsolute: ui.playheadFrame,
          })
        }
        className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] disabled:opacity-40"
        title="Split en playhead (Ctrl+K)"
      >
        Split
      </button>
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => {
          dispatchSb({ type: 'RIPPLE_DELETE', sceneIds: ui.selection });
          dispatchUi({ type: 'CLEAR_SELECTION' });
        }}
        className="rounded border border-[var(--red-ring)] px-2 py-1 text-xs font-semibold text-[var(--red-hi)] hover:bg-[var(--red-soft)] disabled:opacity-40"
        title="Ripple delete (Del)"
      >
        Eliminar
      </button>

      <div className="mx-1 h-5 w-px bg-[var(--bg-3)]" aria-hidden />

      {/* Snap */}
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_SNAP' })}
        className={`rounded px-2 py-1 text-xs font-semibold ${
          ui.snapEnabled ? 'bg-brand-yellow text-[var(--fg-1)]' : 'text-[var(--fg-3)] hover:bg-[var(--bg-3)]'
        }`}
        title="Magnetic snap"
      >
        🧲 Snap
      </button>

      {/* Zoom */}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={zoomOut}
          className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs font-bold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
        >
          −
        </button>
        <span className="w-14 text-center font-mono text-[10px] text-[var(--fg-3)]">
          {pxPerFrame}x
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs font-bold text-[var(--fg-2)] hover:bg-[var(--bg-1)]"
        >
          +
        </button>
      </div>

      {/* Info */}
      <span className="ml-2 text-[10px] text-[var(--fg-4)]">
        {sb.project.scenes.length} escenas · {selCount} seleccionadas
      </span>
    </div>
  );
}
