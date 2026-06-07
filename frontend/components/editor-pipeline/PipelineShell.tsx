'use client';

import Link from 'next/link';
import { useCallback, useMemo, type CSSProperties } from 'react';
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
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--fg-1)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Editor · pipeline cinematográfico
            </span>
            <span
              className="mono"
              style={{
                marginLeft: 'auto',
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--bg-3)',
                border: '1px solid var(--line)',
                fontSize: 11,
                color: 'var(--fg-3)',
              }}
            >
              {projectId}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <PipelineStepper
              current={current}
              status={state.status}
              onJump={goToPhase}
            />
          </div>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--fg-1)',
              margin: 0,
            }}
          >
            {PHASE_LABEL[current]}
          </h2>
          <p style={{ marginTop: 4, fontSize: 14, color: 'var(--fg-3)' }}>{PHASE_HINT[current]}</p>
          {loadError && (
            <p
              style={{
                marginTop: 8,
                borderRadius: 6,
                background: 'var(--red-soft)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--red-hi)',
              }}
            >
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
    </div>
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
    <div
      style={{
        display: 'flex',
        minHeight: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          borderRadius: 18,
          border: '1px solid var(--line)',
          background: 'var(--bg-2)',
          padding: 32,
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span
          style={{
            marginBottom: 16,
            display: 'inline-flex',
            height: 56,
            width: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            background: 'var(--blue-soft)',
            fontSize: 30,
          }}
        >
          🎬
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', margin: 0, fontFamily: 'var(--font-display)' }}>
          El editor necesita un proyecto
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--fg-3)' }}>
          Crea contenido desde <strong style={{ color: 'var(--fg-2)' }}>Scripts</strong>,{' '}
          <strong style={{ color: 'var(--fg-2)' }}>Avatar</strong> o subí tus propios clips desde{' '}
          <strong style={{ color: 'var(--fg-2)' }}>Edición</strong>.
        </p>
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Link href="/scripts" style={primaryLinkStyle}>
            🧠 Ir a Scripts
          </Link>
          <Link href="/avatar" style={outlineLinkStyle}>
            🎭 Ir a Avatar
          </Link>
          <Link href="/editor/manual" style={outlineLinkStyle}>
            📎 Edición desde Clips
          </Link>
        </div>
      </div>
    </div>
  );
}

const primaryLinkStyle: CSSProperties = {
  borderRadius: 8,
  background: 'var(--blue)',
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  textDecoration: 'none',
  border: '1px solid var(--blue-lo)',
};

const outlineLinkStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--line-strong)',
  background: 'var(--bg-3)',
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--fg-2)',
  textDecoration: 'none',
};
