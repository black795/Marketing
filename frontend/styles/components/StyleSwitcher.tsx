'use client';

import { useMemo, useState } from 'react';
import { useStoryboard } from '@/storyboard';
import { newVersionId } from '@/editing';
import type { Scene } from '@/editing';
import { STYLE_PACKS } from '../presets';
import type { StylePack } from '../configs/style-pack';
import { applyStylePack } from '../engines/processor';
import StylePackCard from './StylePackCard';
import StylePromptInput from './StylePromptInput';

interface Props {
  /** Si se pasa, aplica sólo a esa escena. */
  onlySceneId?: string;
  /** 'grid' (página dedicada) o 'chip-row' (compact). */
  variant?: 'grid' | 'chip-row';
  onSelect?: (pack: StylePack) => void;
}

/**
 * Switcher de StylePacks. Aplica el pack escogido al proyecto via dispatch
 * APPLY_PROJECT, guardando snapshot previo en las versions[] de cada escena
 * cambiada (revert por escena posible).
 */
export default function StyleSwitcher({
  onlySceneId,
  variant = 'grid',
  onSelect,
}: Props) {
  const { state, dispatch } = useStoryboard();
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  const activeId = state.project.stylePreset?.id ?? null;

  const apply = useMemo(
    () =>
      (pack: StylePack) => {
        const before = new Map(state.project.scenes.map((s) => [s.id, s]));
        const { project, report } = applyStylePack(state.project, pack, { onlySceneId });
        const scenes = project.scenes.map((s) => {
          const prev = before.get(s.id);
          if (!prev) return s;
          if (sceneChanged(prev, s)) return carryVersion(prev, s, `${pack.emoji} ${pack.label}`);
          return s;
        });
        dispatch({ type: 'APPLY_PROJECT', project: { ...project, scenes } });
        setLastApplied(
          `${report.packLabel} aplicado · ${report.scenesProcessed} escena${report.scenesProcessed === 1 ? '' : 's'} · ${report.overlaysInjected} overlays · ${report.effectsAdded} efectos`
        );
        onSelect?.(pack);
      },
    [state.project, onlySceneId, dispatch, onSelect]
  );

  if (variant === 'chip-row') {
    return (
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto py-1">
          {STYLE_PACKS.map((p) => (
            <StylePackCard
              key={p.id}
              pack={p}
              active={activeId === p.id}
              onClick={() => apply(p)}
              variant="chip"
            />
          ))}
        </div>
        <StylePromptInput onMatch={apply} />
        {lastApplied && (
          <p className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
            {lastApplied}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StylePromptInput onMatch={apply} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {STYLE_PACKS.map((p) => (
          <StylePackCard
            key={p.id}
            pack={p}
            active={activeId === p.id}
            onClick={() => apply(p)}
          />
        ))}
      </div>
      {lastApplied && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {lastApplied}
        </p>
      )}
    </div>
  );
}

// ---- Helpers (versioning para revert por escena) -------------------------

function carryVersion(prev: Scene, current: Scene, label: string): Scene {
  const { versions: _omit, ...snapshot } = prev;
  return {
    ...current,
    versions: [
      ...prev.versions,
      {
        id: newVersionId(),
        createdAt: new Date().toISOString(),
        reason: 'style-pack',
        label,
        snapshot,
      },
    ].slice(-30),
  };
}

function sceneChanged(a: Scene, b: Scene): boolean {
  if (a.stylePresetId !== b.stylePresetId) return true;
  if (a.captions[0]?.style !== b.captions[0]?.style) return true;
  if (a.overlays.length !== b.overlays.length) return true;
  if (a.effects.length !== b.effects.length) return true;
  if (JSON.stringify(a.camera) !== JSON.stringify(b.camera)) return true;
  if (JSON.stringify(a.transition) !== JSON.stringify(b.transition)) return true;
  return false;
}
