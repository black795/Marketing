'use client';

import { TRACK_METAS, type TimelineTrackKind } from '../types/ui';
import { useTimelineUi } from '../store/context';

interface Props {
  kind: TimelineTrackKind;
  heightPx: number;
}

/**
 * Cabecera de pista (lado izquierdo). Mute / solo / lock + nombre.
 */
export default function TrackHeader({ kind, heightPx }: Props) {
  const { ui, dispatchUi } = useTimelineUi();
  const meta = TRACK_METAS.find((m) => m.id === kind)!;
  const isMuted = ui.mutedTracks.includes(kind);
  const isSoloed = ui.soloedTracks.includes(kind);
  const isLocked = ui.lockedTracks.includes(kind);

  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b border-r border-neutral-200 bg-neutral-50 px-2"
      style={{ height: heightPx }}
    >
      <span className="text-base leading-none">{meta.emoji}</span>
      <span className="flex-1 truncate text-[11px] font-semibold text-neutral-700">
        {meta.label}
      </span>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'muted' })}
        title="Mute"
        className={`rounded px-1 text-[10px] font-bold ${isMuted ? 'bg-red-500 text-white' : 'text-neutral-400 hover:text-neutral-700'}`}
      >
        M
      </button>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'soloed' })}
        title="Solo"
        className={`rounded px-1 text-[10px] font-bold ${isSoloed ? 'bg-yellow-400 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}
      >
        S
      </button>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'locked' })}
        title="Lock"
        className={`rounded px-1 text-[10px] font-bold ${isLocked ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-700'}`}
      >
        🔒
      </button>
    </div>
  );
}
