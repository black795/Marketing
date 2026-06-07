'use client';

// Tim Koda OS - Navigation shell (PhaseRail + TopBar + CommandBar + WorkflowShell)
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Icon, type IconComponent } from './icons';
import { Badge, CharAvatar, Kbd } from './primitives';

export type PhaseId =
  | 'home'
  | 'prompt'
  | 'review'
  | 'scenes'
  | 'storyboard'
  | 'carousel'
  | 'styles'
  | 'timeline'
  | 'export'
  | 'editor'
  | 'library'
  | 'projects'
  | 'avatar'
  | 'settings';

export type Phase = {
  id: PhaseId;
  label: string;
  short: string;
  icon: IconComponent;
  path: string;
};

export const PHASES: Phase[] = [
  { id: 'home', label: 'Inicio', short: 'Modo', icon: Icon.Sparkles, path: '/' },
  { id: 'prompt', label: 'Prompt', short: 'Input', icon: Icon.Wand, path: '/scripts' },
  { id: 'review', label: 'Revision', short: 'Guion', icon: Icon.Type, path: '/scripts/review' },
  { id: 'scenes', label: 'Escenas', short: 'Imagenes', icon: Icon.Image, path: '/scripts/scenes' },
  { id: 'storyboard', label: 'Video', short: 'Clips', icon: Icon.Film, path: '/storyboard' },
  { id: 'carousel', label: 'Carrusel', short: 'Slides', icon: Icon.Copy, path: '/carousel' },
  { id: 'styles', label: 'Estilo', short: 'Look', icon: Icon.Flame, path: '/styles' },
  { id: 'timeline', label: 'Timeline', short: 'Video', icon: Icon.Film, path: '/timeline' },
  { id: 'export', label: 'Export', short: 'Render', icon: Icon.Download, path: '/export' },
];

/** Accesos a lo guardado (no son fases del flujo, viven al pie del rail). */
export const RAIL_UTILITIES: Phase[] = [
  { id: 'library', label: 'Biblioteca', short: 'Guardado', icon: Icon.Layers, path: '/library' },
  { id: 'projects', label: 'Mis proyectos', short: 'Proyectos', icon: Icon.Save, path: '/projects' },
];

export const PHASE_ORDER: PhaseId[] = [
  'home',
  'prompt',
  'review',
  'scenes',
  'storyboard',
  'carousel',
  'styles',
  'timeline',
  'export',
];

const BREADCRUMBS: Record<PhaseId, string[]> = {
  home: ['Inicio'],
  prompt: ['Scripts', 'Prompt'],
  review: ['Scripts', 'Guion'],
  scenes: ['Scripts', 'Escenas'],
  storyboard: ['Scripts', 'Video'],
  carousel: ['Scripts', 'Carrusel'],
  styles: ['Scripts', 'Estilo'],
  timeline: ['Scripts', 'Timeline'],
  export: ['Scripts', 'Export'],
  editor: ['Editor'],
  library: ['Biblioteca'],
  projects: ['Mis proyectos'],
  avatar: ['Avatar'],
  settings: ['Configuracion'],
};

// ---------- PhaseRail ----------
export function PhaseRail({ currentId }: { currentId: PhaseId }) {
  const idx = PHASE_ORDER.indexOf(currentId);
  const completed = new Set<PhaseId>(idx > 0 ? PHASE_ORDER.slice(0, idx) : []);

  return (
    <div
      style={{
        width: 72,
        flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        position: 'relative',
      }}
    >
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, var(--blue) 0%, var(--red) 100%)',
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 18,
              fontFamily: 'var(--font-display)',
              boxShadow: '0 8px 20px -6px var(--blue-glow)',
            }}
          >
            TK
          </div>
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
          width: '100%',
          padding: '0 12px',
          position: 'relative',
        }}
      >
        {PHASES.map((p, i) => {
          const active = p.id === currentId;
          const done = completed.has(p.id);
          return (
            <Link
              key={p.id}
              href={p.path}
              title={`${p.label} - ${p.short}`}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: active ? 'var(--blue-soft)' : 'transparent',
                color: active ? 'var(--blue-hi)' : done ? 'var(--fg-1)' : 'var(--fg-3)',
                border: active ? '1px solid var(--blue-ring)' : '1px solid transparent',
                transition: 'all 200ms var(--ease-out)',
                position: 'relative',
                textDecoration: 'none',
              }}
            >
              <p.icon size={18} />
              <span
                className="mono"
                style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: 0.5 }}
              >
                {String(i).padStart(2, '0')}
              </span>
              {done && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: 'var(--success)',
                  }}
                />
              )}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    left: -12,
                    top: 14,
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: 'var(--blue)',
                    boxShadow: '0 0 12px var(--blue-glow)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Utilidades: acceso a lo guardado desde cualquier pantalla. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: '100%',
          padding: '12px 12px 0',
          marginTop: 8,
          borderTop: '1px solid var(--line)',
        }}
      >
        {RAIL_UTILITIES.map((u) => {
          const active = u.id === currentId;
          return (
            <Link
              key={u.id}
              href={u.path}
              title={`${u.label} - ${u.short}`}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: active ? 'var(--blue-soft)' : 'transparent',
                color: active ? 'var(--blue-hi)' : 'var(--fg-3)',
                border: active ? '1px solid var(--blue-ring)' : '1px solid transparent',
                transition: 'all 200ms var(--ease-out)',
                textDecoration: 'none',
              }}
            >
              <u.icon size={18} />
              <span
                className="mono"
                style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: 0.3 }}
              >
                {u.short}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------- TopBar ----------
export function TopBar({ phase }: { phase: PhaseId }) {
  const idx = PHASE_ORDER.indexOf(phase);
  const crumbs = BREADCRUMBS[phase];

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: 'var(--success)',
            boxShadow: '0 0 8px var(--success)',
          }}
        />
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1 }}
        >
          online
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--line)' }} />

      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-2)' }}>
        <span style={{ color: 'var(--fg-3)' }}>Tim Koda</span>
        <Icon.ChevR size={12} />
        {crumbs.map((b, i) => (
          <React.Fragment key={i}>
            {i === crumbs.length - 1 ? (
              <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{b}</span>
            ) : (
              <>
                <span>{b}</span>
                <Icon.ChevR size={12} />
              </>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <Link
        href="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--fg-2)',
          cursor: 'pointer',
          fontSize: 12,
          textDecoration: 'none',
        }}
      >
        <Icon.Settings size={13} /> Config
      </Link>

      {phase !== 'home' && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge tone="default" icon={Icon.Sparkles}>
              nano-banana-pro
            </Badge>
            {idx > 0 && idx < PHASE_ORDER.length - 1 && (
              <Badge tone="blue" dot>
                Fase {String(idx).padStart(2, '0')}/0{PHASE_ORDER.length - 1}
              </Badge>
            )}
          </div>
        </>
      )}
      <div style={{ width: 1, height: 20, background: 'var(--line)' }} />
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 99,
          background: 'var(--bg-3)',
          color: 'var(--fg-1)',
          fontSize: 12,
          border: '1px solid var(--line-strong)',
          cursor: 'pointer',
        }}
      >
        <CharAvatar name="Tim Koda" size={20} hue={210} /> Tim
      </button>
    </header>
  );
}

// ---------- CommandBar ----------
export function CommandBar({ phase }: { phase: PhaseId }) {
  const router = useRouter();
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0) return null;
  const prevId = idx > 0 ? PHASE_ORDER[idx - 1] : null;
  const nextId = idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
  const prev = prevId ? PHASES.find((p) => p.id === prevId) : null;
  const next = nextId ? PHASES.find((p) => p.id === nextId) : null;

  const cmdBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 24,
    padding: '0 8px',
    borderRadius: 5,
    background: 'transparent',
    border: '1px solid var(--line)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--fg-2)',
    cursor: 'pointer',
    transition: 'all 180ms',
    fontFamily: 'var(--font-mono)',
  };

  return (
    <div
      style={{
        height: 36,
        flexShrink: 0,
        borderTop: '1px solid var(--line)',
        background: 'var(--bg-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1 }}
      >
        Fase {String(idx).padStart(2, '0')}/0{PHASE_ORDER.length - 1}
      </div>
      <div style={{ width: 1, height: 14, background: 'var(--line)' }} />

      {prev && (
        <button onClick={() => router.push(prev.path)} style={cmdBtn}>
          <Kbd>{'←'}</Kbd> {prev.label}
        </button>
      )}
      {next && (
        <button onClick={() => router.push(next.path)} style={cmdBtn}>
          {next.label} <Kbd>{'→'}</Kbd>
        </button>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--fg-3)' }}>
        <span>
          <Kbd>{'⌘'}</Kbd> <Kbd>K</Kbd> comandos
        </span>
        <span>
          <Kbd>?</Kbd> ayuda
        </span>
        <span>
          <Kbd>esc</Kbd> volver
        </span>
      </div>
    </div>
  );
}

// ---------- WorkflowShell ----------
export function WorkflowShell({
  phase,
  children,
  showCommandBar = true,
}: {
  phase: PhaseId;
  children?: ReactNode;
  showCommandBar?: boolean;
}) {
  return (
    <div
      className="koda-os-root"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-0)',
      }}
    >
      <PhaseRail currentId={phase} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar phase={phase} />

        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div className="anim-fade-up">{children}</div>
        </main>

        {showCommandBar && phase !== 'home' && <CommandBar phase={phase} />}
      </div>
    </div>
  );
}

export { usePathname };
