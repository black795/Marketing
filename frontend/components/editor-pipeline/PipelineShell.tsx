'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import {
  isSetupValid,
  nextPhase,
  PHASE_HINT,
  PHASE_LABEL,
  prevPhase,
  type Phase,
} from '@/lib/editor-pipeline/types';
import { usePipelineProject } from '@/lib/editor-pipeline/usePipelineProject';
import PipelineStepper from './PipelineStepper';
import PipelineFooter from './PipelineFooter';
import SetupPhase from './phases/SetupPhase';
import ImportPhase from './phases/ImportPhase';
import StoryboardPhase from './phases/StoryboardPhase';
import TimelinePhase from './phases/TimelinePhase';
import StylePhase from './phases/StylePhase';
import CaptionsPhase from './phases/CaptionsPhase';
import AiAssistantPhase from './phases/AiAssistantPhase';
import ExportPhase from './phases/ExportPhase';

/**
 * Shell del pipeline secuencial — reemplaza el grid de 6 cards anterior.
 *
 * Mantiene la máquina de estados (currentPhase), persiste a backend vía
 * usePipelineProject (autosave debounced) y renderiza la fase activa.
 *
 * Si no hay projectId, mostramos un empty state que invita a entrar desde
 * /scripts o /avatar — el editor standalone llega en Ola 2.
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
  const setupValid = useMemo(() => isSetupValid(state.setup), [state.setup]);

  // Por fase: ¿está el usuario habilitado para avanzar al siguiente paso?
  const canContinue = useMemo(() => {
    if (current === 'setup') return setupValid;
    // Las fases siguientes son herramientas — basta con visitarlas. Si el
    // status ya está visited/completed/skipped, podemos avanzar.
    const st = state.status[current];
    return st === 'visited' || st === 'completed' || st === 'skipped';
  }, [current, setupValid, state.status]);

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

  const onSkip = useCallback(() => {
    const next = nextPhase(current);
    if (!next) return;
    setState((prev) => ({
      ...prev,
      status: { ...prev.status, [current]: 'skipped' },
    }));
    goToPhase(next);
  }, [current, goToPhase, setState]);

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
              setupValid={setupValid}
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
          state={state}
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
        onSkip={current === 'ai-assistant' ? onSkip : undefined}
      />
    </main>
  );
}

function PhaseContent({
  phase,
  projectId,
  state,
  setState,
}: {
  phase: Phase;
  projectId: string;
  state: ReturnType<typeof usePipelineProject>['state'];
  setState: ReturnType<typeof usePipelineProject>['setState'];
}) {
  switch (phase) {
    case 'setup':
      return (
        <SetupPhase
          value={state.setup}
          onChange={(setup) => setState((prev) => ({ ...prev, setup }))}
        />
      );
    case 'import':
      return (
        <ImportPhase
          projectId={projectId}
          value={state.imports}
          onChange={(imports) => setState((prev) => ({ ...prev, imports }))}
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
    case 'timeline':
      return (
        <TimelinePhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.timeline === 'pending'
                ? { ...prev, status: { ...prev.status, timeline: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'style':
      return (
        <StylePhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.style === 'pending'
                ? { ...prev, status: { ...prev.status, style: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'captions':
      return (
        <CaptionsPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.captions === 'pending'
                ? { ...prev, status: { ...prev.status, captions: 'visited' } }
                : prev
            )
          }
        />
      );
    case 'ai-assistant':
      return <AiAssistantPhase />;
    case 'export':
      return (
        <ExportPhase
          projectId={projectId}
          onTouched={() =>
            setState((prev) =>
              prev.status.export === 'pending'
                ? { ...prev, status: { ...prev.status, export: 'visited' } }
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
          Crea contenido desde <strong>Scripts</strong> o <strong>Avatar</strong> y
          continúa al editor con un click. El pipeline se inicializa con los
          assets ya generados.
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
        <div className="mt-6 text-[11px] text-neutral-400">
          Puedes seguir abriendo las herramientas individuales:{' '}
          <Link href="/storyboard" className="hover:text-brand-pink">storyboard</Link>,{' '}
          <Link href="/timeline" className="hover:text-brand-pink">timeline</Link>,{' '}
          <Link href="/styles" className="hover:text-brand-pink">styles</Link>,{' '}
          <Link href="/export" className="hover:text-brand-pink">export</Link>.
        </div>
      </div>
    </main>
  );
}
