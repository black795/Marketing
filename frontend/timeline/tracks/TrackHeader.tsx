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
      className="flex shrink-0 items-center gap-1 border-b border-r border-[var(--line)] bg-[var(--bg-1)] px-2"
      style={{ height: heightPx }}
    >
      <span className="text-base leading-none">{meta.emoji}</span>
      <span className="flex-1 truncate text-[11px] font-semibold text-[var(--fg-2)]">
        {meta.label}
      </span>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'muted' })}
        title="Mute"
        className={`rounded px-1 text-[10px] font-bold ${isMuted ? 'bg-[var(--red)] text-white' : 'text-[var(--fg-4)] hover:text-[var(--fg-2)]'}`}
      >
        M
      </button>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'soloed' })}
        title="Solo"
        className={`rounded px-1 text-[10px] font-bold ${isSoloed ? 'bg-yellow-400 text-[var(--fg-1)]' : 'text-[var(--fg-4)] hover:text-[var(--fg-2)]'}`}
      >
        S
      </button>
      <button
        type="button"
        onClick={() => dispatchUi({ type: 'TOGGLE_TRACK', track: kind, flag: 'locked' })}
        title="Lock"
        className={`rounded px-1 text-[10px] font-bold ${isLocked ? 'bg-[var(--fg-2)] text-white' : 'text-[var(--fg-4)] hover:text-[var(--fg-2)]'}`}
      >
        🔒
      </button>
    </div>
  );
}
