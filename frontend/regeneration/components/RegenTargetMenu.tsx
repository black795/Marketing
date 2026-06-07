'use client';

import { useState, useEffect, useRef } from 'react';
import type { Scene } from '@/editing';
import { TARGET_METAS, type RegenTarget } from '../types/job';
import { useRegenQueue } from '../queue/context';

interface Props {
  scene: Scene;
  variant?: 'button' | 'inline';
}

/**
 * Dropdown que lista los 9 targets de regen para una escena. Al click,
 * encola un RegenJob — el provider lo ejecuta enseguida y actualiza el
 * scene graph + crea versión previa (vía APPLY_PROJECT del storyboard).
 */
export default function RegenTargetMenu({ scene, variant = 'button' }: Props) {
  const { dispatch } = useRegenQueue();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function enqueue(target: RegenTarget) {
    dispatch({
      type: 'ENQUEUE',
      sceneId: scene.id,
      sceneName: scene.name,
      sceneNumber: scene.sceneNumber,
      target,
    });
    setOpen(false);
  }

  if (variant === 'inline') {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
          Regenerar
        </p>
        <ul className="grid grid-cols-3 gap-1.5">
          {TARGET_METAS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => enqueue(m.id)}
                className="flex w-full flex-col items-center gap-0.5 rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1.5 text-center text-[10px] font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] hover:text-[var(--blue-hi)]"
                title={m.description}
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="truncate">{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-2.5 py-1 text-xs font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] hover:text-[var(--blue-hi)]"
      >
        🪄 Regenerar…
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-1 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
            Regen modular — {scene.name}
          </p>
          <ul>
            {TARGET_METAS.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => enqueue(m.id)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-1)]"
                >
                  <span className="text-base leading-none">{m.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--fg-1)]">{m.label}</span>
                    <span className="block text-[10px] text-[var(--fg-3)]">{m.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
