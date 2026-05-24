/**
 * Estado UI exclusivo del timeline — no afecta al proyecto.
 *
 * El proyecto vive en el store del Storyboard. El timeline sólo añade
 * zoom, playhead, scroll, tool y selection — todo lo cosmético.
 */
import type { TimelineTool } from './tools';

/** Tracks que el timeline muestra como pistas separadas. */
export type TimelineTrackKind =
  | 'video'
  | 'voice'
  | 'music'
  | 'sfx'
  | 'captions'
  | 'overlays'
  | 'effects';

export interface TrackMeta {
  id: TimelineTrackKind;
  label: string;
  emoji: string;
  color: string; // tailwind color for the clip blocks
}

export const TRACK_METAS: TrackMeta[] = [
  { id: 'video', label: 'Video', emoji: '🎞️', color: 'bg-brand-pink/80' },
  { id: 'voice', label: 'Voz', emoji: '🎙️', color: 'bg-indigo-500/80' },
  { id: 'music', label: 'Música', emoji: '🎵', color: 'bg-violet-500/80' },
  { id: 'sfx', label: 'SFX', emoji: '💥', color: 'bg-amber-500/80' },
  { id: 'captions', label: 'Captions', emoji: '💬', color: 'bg-emerald-500/80' },
  { id: 'overlays', label: 'Overlays', emoji: '✨', color: 'bg-fuchsia-500/80' },
  { id: 'effects', label: 'Efectos', emoji: '⚡', color: 'bg-sky-500/80' },
];

export interface TimelineUiState {
  /** Píxeles por frame. 4 = "muy zoom in", 0.5 = "zoom out muy alejado". */
  pxPerFrame: number;
  /** Scroll horizontal en px. */
  scrollLeft: number;
  /** Posición del playhead en frames (absolutos del proyecto). */
  playheadFrame: number;
  tool: TimelineTool;
  /** sceneIds seleccionados (multi-select). */
  selection: string[];
  snapEnabled: boolean;
  /** Tracks visibles. Si vacío, se asume todos. */
  hiddenTracks: TimelineTrackKind[];
  /** Tracks soloed (si hay alguno, solo esos se ven). */
  soloedTracks: TimelineTrackKind[];
  /** Tracks muted (visual; el render decide). */
  mutedTracks: TimelineTrackKind[];
  /** Tracks bloqueados — no permiten interacción. */
  lockedTracks: TimelineTrackKind[];
}

export interface DragGesture {
  kind: 'move' | 'trim-left' | 'trim-right' | 'playhead' | null;
  sceneId: string | null;
  startClientX: number;
  startFrame: number;
  startDuration: number;
}

export function defaultUiState(): TimelineUiState {
  return {
    pxPerFrame: 2,
    scrollLeft: 0,
    playheadFrame: 0,
    tool: 'select',
    selection: [],
    snapEnabled: true,
    hiddenTracks: [],
    soloedTracks: [],
    mutedTracks: [],
    lockedTracks: [],
  };
}
