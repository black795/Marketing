'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PIPELINE,
  type PipelineState,
  type Phase,
  PHASE_LABEL,
} from './types';
import { loadPipelineState, savePipelineState } from './api';

export type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 700;

/**
 * Hook de estado del pipeline. Carga desde el backend al montar, expone el
 * state vivo y autoguarda con debounce. Si el projectId es null, opera en
 * modo "vacío" sin tocar el backend (el shell muestra un empty state).
 *
 * El save es best-effort: si falla, se marca status='error' pero no se pierde
 * el cambio local — el siguiente edit lo reintenta.
 */
export function usePipelineProject(projectId: string | null) {
  const [state, setStateInternal] = useState<PipelineState>(DEFAULT_PIPELINE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Evita autosave durante la carga inicial.
  const hydratedRef = useRef(false);
  // Debounce timer.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Generation token: si el componente cambia projectId, abortamos saves viejos.
  const saveGenRef = useRef(0);

  // ---------- Carga inicial ----------
  useEffect(() => {
    hydratedRef.current = false;
    if (!projectId) {
      setStateInternal(DEFAULT_PIPELINE);
      setSaveStatus('idle');
      setLoadError(null);
      hydratedRef.current = true;
      return;
    }
    let cancelled = false;
    setSaveStatus('loading');
    setLoadError(null);
    loadPipelineState(projectId)
      .then((loaded) => {
        if (cancelled) return;
        setStateInternal(loaded ?? DEFAULT_PIPELINE);
        setSaveStatus(loaded ? 'saved' : 'idle');
        hydratedRef.current = true;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStateInternal(DEFAULT_PIPELINE);
        setSaveStatus('error');
        setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto');
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [projectId]);

  // ---------- Autosave debounced ----------
  useEffect(() => {
    if (!projectId) return;
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const gen = ++saveGenRef.current;
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      savePipelineState(projectId, state)
        .then(() => {
          if (gen !== saveGenRef.current) return; // newer save in flight
          setSaveStatus('saved');
        })
        .catch((err: unknown) => {
          if (gen !== saveGenRef.current) return;
          setSaveStatus('error');
          console.error('[pipeline] save failed', err);
        });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, projectId]);

  // ---------- API expuesta ----------
  const setState = useCallback(
    (updater: (prev: PipelineState) => PipelineState) => {
      setStateInternal((prev) => updater(prev));
    },
    []
  );

  const goToPhase = useCallback((phase: Phase) => {
    setStateInternal((prev) => ({
      ...prev,
      currentPhase: phase,
      status: {
        ...prev.status,
        [phase]: prev.status[phase] === 'pending' ? 'visited' : prev.status[phase],
      },
    }));
  }, []);

  const markCompleted = useCallback((phase: Phase) => {
    setStateInternal((prev) => ({
      ...prev,
      status: { ...prev.status, [phase]: 'completed' },
    }));
  }, []);

  return {
    state,
    setState,
    goToPhase,
    markCompleted,
    saveStatus,
    loadError,
  };
}

export function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Cargando proyecto…';
    case 'saving':
      return 'Guardando…';
    case 'saved':
      return 'Guardado';
    case 'error':
      return 'Error al guardar';
  }
}

export function phaseLabel(p: Phase): string {
  return PHASE_LABEL[p];
}
