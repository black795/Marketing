'use client';

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { defaultUiState, reducer, type TimelineUiState } from './reducer';
import type { TimelineUiAction } from './actions';

interface Value {
  ui: TimelineUiState;
  dispatchUi: Dispatch<TimelineUiAction>;
}

const Ctx = createContext<Value | null>(null);

/**
 * Provider del UI del timeline. Vive ANIDADO dentro del StoryboardProvider —
 * el proyecto sigue siendo una sola fuente de verdad; este provider sólo
 * añade zoom, playhead, tool, selection cosméticas.
 */
export function TimelineUiProvider({ children }: { children: ReactNode }) {
  const [ui, dispatchUi] = useReducer(reducer, undefined, defaultUiState);
  const value = useMemo(() => ({ ui, dispatchUi }), [ui]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTimelineUi(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTimelineUi debe usarse dentro de <TimelineUiProvider>.');
  return v;
}
