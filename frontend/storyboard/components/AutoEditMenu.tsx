'use client';

import { useEffect, useRef, useState } from 'react';
import { AUTO_EDIT_PRESETS, type AutoEditPreset } from '@/editing/engine';
import { useStoryboard } from '../store/context';
import { runAutoEditWithVersioning } from '../utils/auto-edit-apply';

interface Props {
  /** Si se pasa, el botón aplica solo a esa escena. */
  onlySceneId?: string;
  /** Variant — el global topbar es 'compact'; el de ScenePreview es 'wide'. */
  variant?: 'compact' | 'wide';
}

/**
 * Botón + popover con los presets del Auto Editing Engine.
 *
 * Compact: usa un único botón con dropdown.
 * Wide: lista los presets en línea (cards) para el panel derecho.
 */
export default function AutoEditMenu({ onlySceneId, variant = 'compact' }: Props) {
  const { state, dispatch } = useStoryboard();
  const [open, setOpen] = useState(false);
  const [lastReport, setLastReport] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar el popover al click fuera.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function apply(preset: AutoEditPreset) {
    const { project, report } = runAutoEditWithVersioning(
      state.project,
      preset.config,
      { onlySceneId, label: `${preset.emoji} ${preset.label}` }
    );
    dispatch({ type: 'APPLY_PROJECT', project });
    setLastReport(
      `${preset.emoji} ${preset.label} aplicado · ${report.scenesProcessed} escena${report.scenesProcessed === 1 ? '' : 's'} · ${report.captionsRewritten} captions · ${report.sfxInserted} SFX`
    );
    setOpen(false);
  }

  if (variant === 'wide') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
          Auto edit IA {onlySceneId ? '(solo esta escena)' : '(proyecto)'}
        </p>
        <ul className="grid grid-cols-2 gap-1.5">
          {AUTO_EDIT_PRESETS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => apply(p)}
                className="flex w-full items-start gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1.5 text-left text-[11px] hover:border-[var(--blue)]"
                title={p.description}
              >
                <span className="text-base leading-none">{p.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[var(--fg-1)]">{p.label}</span>
                  <span className="block truncate text-[10px] text-[var(--fg-3)]">
                    {p.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {lastReport && (
          <p className="rounded-md bg-[var(--success-soft)] px-2 py-1 text-[10px] text-[var(--success)]">
            {lastReport}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[var(--blue)] to-[var(--blue-hi)] px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:from-[var(--blue)] hover:to-[var(--blue-hi)]"
        title="Auto-edit: aplica un preset IA al proyecto entero"
      >
        ✨ Auto-edit
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-2 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
            Elige un preset para todo el proyecto
          </p>
          <ul className="space-y-0.5">
            {AUTO_EDIT_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => apply(p)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-1)]"
                >
                  <span className="text-base leading-none">{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--fg-1)]">
                      {p.label}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--fg-3)]">
                      {p.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {lastReport && (
            <p className="mt-2 rounded-md bg-[var(--success-soft)] px-2 py-1 text-[10px] text-[var(--success)]">
              {lastReport}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
