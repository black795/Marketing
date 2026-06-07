'use client';

import { useMemo } from 'react';
import type { Scene } from '@/editing';
import { framesToMmSs, framesToSeconds } from '@/editing';
import { useStoryboard } from '../store/context';
import { pickThumbnail } from '../utils/thumbnails';
import SceneStatusBadge from './SceneStatusBadge';
import ScenePromptEditor from './ScenePromptEditor';
import SceneVersionList from './SceneVersionList';
import AutoEditMenu from './AutoEditMenu';
import { RegenTargetMenu } from '@/regeneration';

interface Props {
  scene: Scene;
  fps: number;
}

/**
 * Panel grande del lado derecho cuando hay una escena seleccionada.
 *
 * Muestra preview de gran tamaño, controles inline (duración, included,
 * eliminar, duplicar), prompt editor con quick-prompts, lista de assets
 * de esta escena y el version list.
 */
export default function ScenePreview({ scene, fps }: Props) {
  const { dispatch } = useStoryboard();
  const thumb = useMemo(() => pickThumbnail(scene), [scene]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-4)]">
            Escena {String(scene.sceneNumber).padStart(2, '0')} · {scene.role}
          </p>
          <input
            type="text"
            value={scene.name}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_SCENE',
                sceneId: scene.id,
                patch: { name: e.target.value },
              })
            }
            className="mt-0.5 w-full bg-transparent text-xl font-bold text-[var(--fg-1)] focus:outline-none"
            aria-label="Nombre de la escena"
          />
        </div>
        <SceneStatusBadge scene={scene} />
      </div>

      {/* Preview grande */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-black">
        <div className="relative mx-auto aspect-[9/16] max-w-[280px]">
          {thumb?.kind === 'video' ? (
            <video
              key={thumb.src}
              src={thumb.src}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : thumb?.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.src}
              alt={scene.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--fg-3)]">
              No hay preview generado todavía
            </div>
          )}
        </div>
      </div>

      {/* Controles inline */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <DurationControl scene={scene} fps={fps} />
        <IncludedToggle scene={scene} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'DUPLICATE_SCENE', sceneId: scene.id })
          }
          className="flex-1 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-2)] hover:border-[var(--blue)] hover:text-[var(--blue-hi)]"
        >
          Duplicar
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(`¿Eliminar la escena "${scene.name}"? No afecta a las versiones del resto del proyecto.`)
            ) {
              dispatch({ type: 'REMOVE_SCENE', sceneId: scene.id });
              dispatch({ type: 'SELECT_SCENE', sceneId: null });
            }
          }}
          className="flex-1 rounded-md border border-[var(--red-ring)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--red-hi)] hover:bg-[var(--red-soft)]"
        >
          Eliminar
        </button>
      </div>

      {/* Prompt editor */}
      <ScenePromptEditor scene={scene} />

      {/* Auto-edit por escena */}
      <AutoEditMenu variant="wide" onlySceneId={scene.id} />

      {/* Regen modular por subelemento */}
      <RegenTargetMenu scene={scene} variant="inline" />

      {/* Assets de esta escena */}
      <SceneAssetsBlock scene={scene} />

      {/* Captions de esta escena */}
      {scene.captions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
            Captions
          </p>
          <ul className="space-y-1 rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-2">
            {scene.captions.map((c) => (
              <li key={c.id} className="text-[11px] text-[var(--fg-2)]">
                💬 {c.text}{' '}
                <span className="text-[var(--fg-4)]">
                  ({c.words.length} palabras · estilo: {c.style})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Versions */}
      <SceneVersionList scene={scene} />
    </div>
  );
}

function DurationControl({ scene, fps }: { scene: Scene; fps: number }) {
  const { dispatch } = useStoryboard();
  const seconds = framesToSeconds(scene.durationFrames, fps);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
        Duración
      </span>
      <div className="flex items-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-2 py-1.5">
        <input
          type="number"
          min={0.5}
          max={30}
          step={0.5}
          value={seconds.toFixed(1)}
          onChange={(e) => {
            const next = Math.max(0.5, Number(e.target.value) || 0.5);
            dispatch({
              type: 'UPDATE_SCENE',
              sceneId: scene.id,
              patch: { durationFrames: Math.round(next * fps) },
            });
          }}
          className="w-12 bg-transparent text-right text-sm font-mono text-[var(--fg-1)] focus:outline-none"
        />
        <span className="text-[11px] text-[var(--fg-3)]">s</span>
        <span className="ml-auto text-[10px] font-mono text-[var(--fg-4)]">
          {framesToMmSs(scene.durationFrames, fps)}
        </span>
      </div>
    </label>
  );
}

function IncludedToggle({ scene }: { scene: Scene }) {
  const { dispatch } = useStoryboard();
  return (
    <label className="flex cursor-pointer flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
        En el render final
      </span>
      <div
        onClick={() =>
          dispatch({ type: 'TOGGLE_INCLUDED', sceneId: scene.id })
        }
        className={`flex h-[34px] items-center justify-between rounded-md border px-2 text-xs font-semibold ${
          scene.included
            ? 'border-[rgba(43,212,164,0.3)] bg-[var(--success-soft)] text-[var(--success)]'
            : 'border-[var(--line-strong)] bg-[var(--bg-2)] text-[var(--fg-3)]'
        }`}
      >
        {scene.included ? 'Incluida' : 'Excluida'}
        <span className="font-mono text-[10px]">
          {scene.included ? 'ON' : 'OFF'}
        </span>
      </div>
    </label>
  );
}

function SceneAssetsBlock({ scene }: { scene: Scene }) {
  if (scene.assets.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--line)] px-3 py-2 text-[11px] text-[var(--fg-4)]">
        Esta escena no tiene assets — regénera la imagen o video desde el flujo
        Scripts.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
        Assets ({scene.assets.length})
      </p>
      <ul className="grid grid-cols-3 gap-1.5">
        {scene.assets.map((a) => (
          <li
            key={a.id}
            className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg-1)]"
          >
            <div className="aspect-square w-full bg-neutral-900">
              {a.kind === 'video' && a.src ? (
                <video src={a.src} muted className="h-full w-full object-cover" />
              ) : a.kind === 'image' && a.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.src}
                  alt={a.kind}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] text-[var(--fg-3)]">
                  {a.kind}
                </div>
              )}
            </div>
            <p className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--fg-3)]">
              {a.kind}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
