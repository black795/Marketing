'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import {
  nextPhase,
  PHASE_HINT,
  PHASE_LABEL,
  prevPhase,
  type Phase,
} from '@/lib/editor-pipeline/types';
import { usePipelineProject } from '@/lib/editor-pipeline/usePipelineProject';
import PipelineStepper from './PipelineStepper';
import PipelineFooter from './PipelineFooter';
import AutoPhase from './phases/AutoPhase';
import ImportPhase from './phases/ImportPhase';
import StoryboardPhase from './phases/StoryboardPhase';
import AssemblePhase from './phases/AssemblePhase';
import SubtitlesPhase from './phases/SubtitlesPhase';

/**
 * Shell del pipeline secuencial. Reducido a dos pasos:
 *   1. Import (galería de archivos)
 *   2. Storyboard
 *
 * Si no hay projectId, mostramos un empty state.
 */
export default function PipelineShell({ projectId }: { projectId: string | null }) {
  if (!projectId) return <NoProjectEmptyState />;

  const {
    state,
    setState,
    goToPhase,
    markCompleted,
    saveStatus,
    loadError,
  } = usePipelineProject(projectId);

  const current = state.currentPhase;

  // Cada paso es una herramienta — basta con visitarla para avanzar.
  const canContinue = useMemo(() => {
    const st = state.status[current];
    return st === 'visited' || st === 'completed' || st === 'skipped';
  }, [current, state.status]);

  const onBack = useCallback(() => {
    const prev = prevPhase(current);
    if (prev) goToPhase(prev);
  }, [current, goToPhase]);

  const onContinue = useCallback(() => {
    const next = nextPhase(current);
    if (!next) return;
    markCompleted(current);
    goToPhase(next);
  }, [current, goToPhase, markCompleted]);

  return (
    <main className="min-h-screen bg-neutral-50 pb-24">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[11px] font-semibold text-neutral-500 hover:text-brand-pink"
            >
              ← Inicio
            </Link>
            <span className="text-sm font-bold text-neutral-900">
              🎬 Editor — pipeline cinematográfico
            </span>
            <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-mono text-neutral-600">
              {projectId}
            </span>
          </div>
          <div className="mt-3">
            <PipelineStepper
              current={current}
              status={state.status}
              onJump={goToPhase}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
            {PHASE_LABEL[current]}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{PHASE_HINT[current]}</p>
          {loadError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠ {loadError}
            </p>
          )}
        </div>

        <PhaseContent
          phase={current}
          projectId={projectId}
          setState={setState}
        />
      </div>

      <PipelineFooter
        current={current}
        prev={prevPhase(current)}
        next={nextPhase(current)}
        canContinue={canContinue}
        saveStatus={saveStatus}
        onBack={onBack}
        onContinue={onContinue}
      />
    </main>
  );
}

function PhaseContent({
  phase,
  projectId,
  setState,
}: {
  phase: Phase;
  projectId: string;
  setState: ReturnType<typeof usePipelineProject>['setState'];
}) {
  switch (phase) {
    case 'auto':
      return (
        <AutoPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.auto === 'pending'
                ? { ...prev, status: { ...prev.status, auto: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'import':
      return (
        <ImportPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.import === 'pending'
                ? { ...prev, status: { ...prev.status, import: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'storyboard':
      return (
        <StoryboardPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.storyboard === 'pending'
                ? { ...prev, status: { ...prev.status, storyboard: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'assemble':
      return (
        <AssemblePhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.assemble === 'pending'
                ? { ...prev, status: { ...prev.status, assemble: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'subtitles':
      return (
        <SubtitlesPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.subtitles === 'pending'
                ? { ...prev, status: { ...prev.status, subtitles: 'visited' } }
                : prev
            )
          }
        />
      );
  }
}

function NoProjectEmptyState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brand-pink/10 text-3xl">
          🎬
        </span>
        <h1 className="text-xl font-bold text-neutral-900">
          El editor necesita un proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Crea contenido desde <strong>Scripts</strong>, <strong>Avatar</strong> o
          subí tus propios clips desde <strong>Edición</strong>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/scripts"
            className="rounded-md bg-brand-pink px-4 py-2 text-sm font-bold text-white hover:bg-pink-600"
          >
            🧠 Ir a Scripts
          </Link>
          <Link
            href="/avatar"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
          >
            🎭 Ir a Avatar
          </Link>
          <Link
            href="/editor/manual"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
          >
            📎 Edición desde Clips
          </Link>
        </div>
      </div>
    </main>
  );
}
