import { defaultUiState, type TimelineUiState } from '../types/ui';
import type { TimelineUiAction } from './actions';

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function reducer(state: TimelineUiState, action: TimelineUiAction): TimelineUiState {
  switch (action.type) {
    case 'SET_ZOOM':
      return { ...state, pxPerFrame: action.pxPerFrame };
    case 'SET_SCROLL':
      return { ...state, scrollLeft: Math.max(0, action.scrollLeft) };
    case 'SET_PLAYHEAD':
      return { ...state, playheadFrame: Math.max(0, action.frame) };
    case 'SET_TOOL':
      return { ...state, tool: action.tool };
    case 'TOGGLE_SELECTION': {
      const present = state.selection.includes(action.sceneId);
      if (action.additive) {
        return {
          ...state,
          selection: present
            ? state.selection.filter((id) => id !== action.sceneId)
            : [...state.selection, action.sceneId],
        };
      }
      return {
        ...state,
        selection: present && state.selection.length === 1 ? [] : [action.sceneId],
      };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selection: [] };
    case 'SELECT_ONLY':
      return { ...state, selection: [action.sceneId] };
    case 'TOGGLE_SNAP':
      return { ...state, snapEnabled: !state.snapEnabled };
    case 'TOGGLE_TRACK': {
      const key =
        action.flag === 'hidden'
          ? 'hiddenTracks'
          : action.flag === 'muted'
            ? 'mutedTracks'
            : action.flag === 'soloed'
              ? 'soloedTracks'
              : 'lockedTracks';
      return { ...state, [key]: toggleInArray(state[key], action.track) };
    }
    default:
      return state;
  }
}

export { defaultUiState };
export type { TimelineUiState };
