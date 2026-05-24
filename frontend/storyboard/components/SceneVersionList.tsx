'use client';

import type { Scene } from '@/editing';
import { useStoryboard } from '../store/context';

interface Props {
  scene: Scene;
}

/**
 * Lista de versiones de la escena (snapshots inmutables).
 *
 * Cada versión muestra el reason, label (opcional) y permite revertir.
 * "Guardar versión" guarda el estado actual como una versión etiquetada,
 * útil para checkpoints manuales antes de regenerar.
 */
export default function SceneVersionList({ scene }: Props) {
  const { dispatch } = useStoryboard();
  const versions = scene.versions;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Historial · {versions.length + 1} versión{versions.length === 0 ? '' : 'es'}
        </p>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'PUSH_VERSION',
              sceneId: scene.id,
              reason: 'manual-checkpoint',
              label: `Checkpoint ${new Date().toLocaleTimeString()}`,
            })
          }
          className="text-[11px] font-semibold text-brand-pink hover:underline"
        >
          + Guardar versión
        </button>
      </div>

      <ol className="space-y-1">
        {/* Versión actual */}
        <li className="flex items-center gap-2 rounded-md border border-brand-pink/40 bg-brand-pink/5 px-2.5 py-1.5">
          <span className="rounded bg-brand-pink px-1.5 py-0.5 text-[9px] font-bold text-white">
            v{versions.length + 1}
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold text-neutral-700">
            Actual
          </span>
          <span className="text-[10px] text-neutral-400">
            {scene.assets.length} asset{scene.assets.length === 1 ? '' : 's'}
          </span>
        </li>

        {/* Versiones pasadas (más recientes arriba) */}
        {[...versions].reverse().map((v, idxFromEnd) => {
          const versionNumber = versions.length - idxFromEnd;
          return (
            <li
              key={v.id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5"
            >
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold text-neutral-700">
                v{versionNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-neutral-700">
                  {v.label ?? v.reason}
                </p>
                <p className="text-[9px] text-neutral-400">
                  {new Date(v.createdAt).toLocaleString()} · {v.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'REVERT_VERSION',
                    sceneId: scene.id,
                    versionId: v.id,
                  })
                }
                className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
              >
                Revertir
              </button>
            </li>
          );
        })}

        {versions.length === 0 && (
          <li className="rounded-md border border-dashed border-neutral-200 px-2.5 py-2 text-[11px] text-neutral-400">
            Aún no hay versiones anteriores. Cada edición o regen crea una.
          </li>
        )}
      </ol>
    </div>
  );
}
