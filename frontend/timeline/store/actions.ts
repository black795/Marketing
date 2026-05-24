import type { TimelineTool, TimelineTrackKind } from '../types';

export type TimelineUiAction =
  | { type: 'SET_ZOOM'; pxPerFrame: number }
  | { type: 'SET_SCROLL'; scrollLeft: number }
  | { type: 'SET_PLAYHEAD'; frame: number }
  | { type: 'SET_TOOL'; tool: TimelineTool }
  | { type: 'TOGGLE_SELECTION'; sceneId: string; additive?: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SELECT_ONLY'; sceneId: string }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'TOGGLE_TRACK'; track: TimelineTrackKind; flag: 'hidden' | 'muted' | 'soloed' | 'locked' };
