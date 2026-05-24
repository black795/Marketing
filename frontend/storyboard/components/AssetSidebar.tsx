'use client';

import { useMemo } from 'react';
import type { TimelineProject, Scene, SceneAsset } from '@/editing';
import { SIDEBAR_TABS, type SidebarTab } from '../types/ui';
import { useStoryboard } from '../store/context';

interface Props {
  project: TimelineProject;
}

interface MaterialEntry {
  id: string;
  label: string;
  preview?: { kind: 'image' | 'video'; src: string };
  scene: Scene;
  meta?: string;
}

/**
 * Sidebar de materiales — tabs por tipo. Lista plana de todos los assets de
 * ese tipo en el proyecto entero (no sólo de la escena seleccionada).
 *
 * Click sobre un item → selecciona la escena dueña (UX: "ir al material").
 */
export default function AssetSidebar({ project }: Props) {
  const { state, dispatch } = useStoryboard();
  const tab = state.sidebarTab;

  const materials = useMemo(() => collectMaterials(project, tab), [project, tab]);
  const meta = SIDEBAR_TABS.find((t) => t.id === tab)!;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white">
      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav
          role="tablist"
          aria-label="Materiales del proyecto"
          className="flex overflow-x-auto"
        >
          {SIDEBAR_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', tab: t.id })}
                className={`relative flex shrink-0 items-center gap-1 px-3 py-2 text-[11px] font-semibold transition ${
                  active
                    ? 'text-brand-pink'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-pink" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {materials.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-400">
            {meta.emptyHint}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {materials.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'SELECT_SCENE', sceneId: m.scene.id })
                  }
                  className="block w-full overflow-hidden rounded-md border border-neutral-200 bg-white text-left hover:border-brand-pink"
                >
                  <div className="aspect-square w-full bg-neutral-900">
                    {m.preview?.kind === 'video' ? (
                      <video
                        src={m.preview.src}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : m.preview?.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.preview.src}
                        alt={m.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                        {tab}
                      </div>
                    )}
                  </div>
                  <p className="truncate px-1.5 py-1 text-[10px] font-semibold text-neutral-700">
                    {m.label}
                  </p>
                  {m.meta && (
                    <p className="truncate px-1.5 pb-1 text-[9px] text-neutral-400">
                      {m.meta}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function collectMaterials(
  project: TimelineProject,
  tab: SidebarTab
): MaterialEntry[] {
  const out: MaterialEntry[] = [];
  for (const scene of project.scenes) {
    if (tab === 'images') {
      for (const a of scene.assets) {
        if (a.kind === 'image' && a.src) {
          out.push({
            id: a.id,
            label: scene.name,
            preview: { kind: 'image', src: a.src },
            scene,
            meta: `Escena ${scene.sceneNumber}`,
          });
        }
      }
    } else if (tab === 'videos') {
      for (const a of scene.assets) {
        if (a.kind === 'video' && a.src) {
          out.push({
            id: a.id,
            label: scene.name,
            preview: { kind: 'video', src: a.src },
            scene,
            meta: `Escena ${scene.sceneNumber}`,
          });
        }
      }
    } else if (tab === 'voices') {
      for (const a of scene.audioTracks) {
        if (a.kind === 'voiceover') {
          out.push({
            id: a.id,
            label: `Voz · escena ${scene.sceneNumber}`,
            scene,
            meta: `${(a.durationFrames / project.renderConfig.fps).toFixed(1)}s`,
          });
        }
      }
    } else if (tab === 'overlays') {
      for (const o of scene.overlays) {
        out.push({
          id: o.id,
          label: `${o.kind} · escena ${scene.sceneNumber}`,
          scene,
        });
      }
    } else if (tab === 'music') {
      for (const a of scene.audioTracks) {
        if (a.kind === 'music') {
          out.push({
            id: a.id,
            label: `Música · escena ${scene.sceneNumber}`,
            scene,
            meta: `vol ${Math.round(a.volume * 100)}%`,
          });
        }
      }
    } else if (tab === 'captions') {
      for (const c of scene.captions) {
        out.push({
          id: c.id,
          label: c.text.slice(0, 36) + (c.text.length > 36 ? '…' : ''),
          scene,
          meta: `${c.words.length} palabras · estilo ${c.style}`,
        });
      }
    } else if (tab === 'sfx') {
      for (const a of scene.audioTracks) {
        if (a.kind === 'sfx') {
          out.push({
            id: a.id,
            label: `SFX · escena ${scene.sceneNumber}`,
            scene,
          });
        }
      }
    }
  }
  return out;
}
