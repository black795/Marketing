'use client';

import { useCallback } from 'react';
import type { Scene } from '@/editing';
import { useStoryboard } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import { useClipDrag } from '../hooks/useClipDrag';

interface Props {
  scene: Scene;
  xPx: number;
  widthPx: number;
  heightPx: number;
  /** Etiqueta dentro del bloque (ej. "01 · Hook"). */
  label: string;
  /** Tailwind clase del color principal. */
  color: string;
  /** Contenido custom (ej. waveform). */
  children?: React.ReactNode;
  /** Si false, no muestra handles de trim. */
  trimmable?: boolean;
}

/**
 * Bloque de un clip en el timeline. Maneja:
 *   - selección (click; shift = additive)
 *   - drag para mover / trim según el tool
 *   - split en click si el tool es 'split'
 */
export default function ClipBlock({
  scene,
  xPx,
  widthPx,
  heightPx,
  label,
  color,
  children,
  trimmable = true,
}: Props) {
  const { dispatch: dispatchSb } = useStoryboard();
  const { ui, dispatchUi } = useTimelineUi();
  const drag = useClipDrag();

  const isSelected = ui.selection.includes(scene.id);
  const isLive = drag.live && drag.dragging;

  const onClickBlock = useCallback(
    (e: React.MouseEvent) => {
      if (ui.tool === 'split') {
        // Split en el playhead si está dentro de la escena, o donde se hizo click.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const px = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(1, px / rect.width));
        const at = scene.startFrame + Math.round(scene.durationFrames * fraction);
        dispatchSb({ type: 'SPLIT_SCENE', sceneId: scene.id, atFrameAbsolute: at });
        return;
      }
      dispatchUi({
        type: 'TOGGLE_SELECTION',
        sceneId: scene.id,
        additive: e.shiftKey,
      });
    },
    [ui.tool, scene.id, scene.startFrame, scene.durationFrames, dispatchSb, dispatchUi]
  );

  const onMouseDownBody = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (ui.tool === 'select') {
        drag.begin('move', scene, e.clientX);
      } else if (ui.tool === 'trim') {
        // En modo trim, click sobre el cuerpo no hace nada; los handles manejan
      }
    },
    [ui.tool, scene, drag]
  );

  const onTrimLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    drag.begin('trim-left', scene, e.clientX);
  };
  const onTrimRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    drag.begin('trim-right', scene, e.clientX);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClickBlock}
      onMouseDown={onMouseDownBody}
      className={`absolute overflow-hidden rounded-md border text-left text-white shadow-sm transition ${color} ${
        isSelected ? 'border-white outline outline-2 outline-[var(--blue)]' : 'border-black/10 hover:border-white'
      } ${isLive ? 'opacity-80' : ''} ${!scene.included ? 'opacity-50 saturate-0' : ''}`}
      style={{ left: xPx, width: widthPx, height: heightPx, top: 0 }}
      title={`${label} · ${scene.durationFrames} frames`}
    >
      {/* Trim handles */}
      {trimmable && (
        <>
          <div
            className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-[var(--bg-2)]/20 hover:bg-[var(--bg-2)]/60"
            onMouseDown={onTrimLeft}
            aria-label="Trim izquierdo"
          />
          <div
            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-[var(--bg-2)]/20 hover:bg-[var(--bg-2)]/60"
            onMouseDown={onTrimRight}
            aria-label="Trim derecho"
          />
        </>
      )}

      {/* Etiqueta */}
      <span className="absolute left-2 top-1 z-10 truncate pr-3 text-[10px] font-bold">
        {label}
      </span>

      {/* Contenido */}
      <div className="absolute inset-x-1.5 inset-y-5 z-0">{children}</div>
    </div>
  );
}
