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
    <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-white px-3 py-1.5">
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
                  ? 'bg-brand-pink text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
              title={`${t.description} (${t.shortcut})`}
            >
              <span>{t.emoji}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />

      {/* Acciones bulk */}
      <button
        type="button"
        disabled={!canDuplicate}
        onClick={() => dispatchSb({ type: 'DUPLICATE_SCENE', sceneId: ui.selection[0] })}
        className="rounded border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:border-brand-pink disabled:opacity-40"
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
        className="rounded border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:border-brand-pink disabled:opacity-40"
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
        className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
        title="Ripple delete (Del)"
      >
        Eliminar
      </button>

      <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />

      {/* Snap */}
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_SNAP' })}
        className={`rounded px-2 py-1 text-xs font-semibold ${
          ui.snapEnabled ? 'bg-brand-yellow text-neutral-800' : 'text-neutral-500 hover:bg-neutral-100'
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
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
        >
          −
        </button>
        <span className="w-14 text-center font-mono text-[10px] text-neutral-500">
          {pxPerFrame}x
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
        >
          +
        </button>
      </div>

      {/* Info */}
      <span className="ml-2 text-[10px] text-neutral-400">
        {sb.project.scenes.length} escenas · {selCount} seleccionadas
      </span>
    </div>
  );
}
