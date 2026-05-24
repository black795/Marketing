'use client';

import { useState } from 'react';
import { useStoryboard, useAutoSave, useSelectedScene } from '@/storyboard';
import { STYLE_PACKS } from '../presets';
import type { StylePack } from '../configs/style-pack';
import StyleSwitcher from './StyleSwitcher';
import StyleLivePreview from './StyleLivePreview';

/**
 * Panel principal del Style Engine — combina switcher + live preview.
 *
 *   ┌─────────────────────────────┬─────────────────────┐
 *   │  Prompt + grid de cards     │  Live preview       │
 *   │  (StyleSwitcher)            │  de la primera      │
 *   │                             │  escena con el      │
 *   │                             │  pack hover/activo  │
 *   └─────────────────────────────┴─────────────────────┘
 */
export default function StylesPanel() {
  const { state } = useStoryboard();
  const selected = useSelectedScene();
  useAutoSave();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeId = state.project.stylePreset?.id ?? null;
  const previewPackId = hoveredId ?? activeId ?? STYLE_PACKS[0].id;
  const previewPack: StylePack = STYLE_PACKS.find((p) => p.id === previewPackId) ?? STYLE_PACKS[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <section className="min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-bold text-neutral-900">Style Packs</h2>
          {selected && (
            <span className="rounded bg-brand-pink/10 px-2 py-0.5 text-[10px] font-semibold text-brand-pink">
              aplicará a "{selected.name}" (escena seleccionada)
            </span>
          )}
          {!selected && (
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              aplicará al proyecto entero
            </span>
          )}
        </header>

        <div
          onMouseLeave={() => setHoveredId(null)}
          onPointerOver={(e) => {
            // Capturamos el id del pack vía data-attr del card más cercano.
            const target = (e.target as HTMLElement).closest<HTMLElement>('[data-pack-id]');
            const id = target?.dataset.packId ?? null;
            setHoveredId(id);
          }}
        >
          <PackGridProxy>
            <StyleSwitcher onlySceneId={selected?.id} />
          </PackGridProxy>
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <StyleLivePreview pack={previewPack} />
      </aside>
    </div>
  );
}

/**
 * Wrapper que añade `data-pack-id` a los hijos del switcher para que
 * el hover-to-preview funcione sin acoplar el Switcher al panel.
 */
function PackGridProxy({ children }: { children: React.ReactNode }) {
  return (
    <div
      ref={(el) => {
        if (!el) return;
        const buttons = el.querySelectorAll<HTMLElement>('button[title]');
        buttons.forEach((b) => {
          const label = b.querySelector('span:last-child')?.textContent ?? '';
          const match = STYLE_PACKS.find((p) => label.includes(p.label));
          if (match) b.dataset.packId = match.id;
        });
      }}
    >
      {children}
    </div>
  );
}
