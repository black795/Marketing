'use client';

import type { Scene } from '@/types/story';

interface SceneCardProps {
  scene: Scene;
  isActive?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  isRegenerating?: boolean;
  onClick: (scene: Scene) => void;
}

export default function SceneCard({
  scene,
  isActive,
  selectionMode = false,
  isSelected = false,
  isRegenerating = false,
  onClick,
}: SceneCardProps) {
  const ariaLabel = selectionMode
    ? `${isSelected ? 'Quitar' : 'Marcar'} la escena ${scene.scene_number} para regenerar: ${scene.scene_title}`
    : `Abrir detalle de la escena ${scene.scene_number}: ${scene.scene_title}`;

  const borderClass = selectionMode
    ? isSelected
      ? 'border-brand-pink ring-2 ring-brand-pink'
      : 'border-neutral-200 hover:border-brand-pink'
    : isActive
    ? 'border-brand-pink ring-2 ring-brand-pink'
    : 'border-neutral-200 hover:border-brand-pink';

  return (
    <button
      type="button"
      onClick={() => onClick(scene)}
      aria-label={ariaLabel}
      aria-pressed={selectionMode ? isSelected : undefined}
      className={`group relative flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-pink ${borderClass}`}
    >
      <div className="relative w-full overflow-hidden bg-neutral-100" style={{ aspectRatio: '9 / 16' }}>
        {scene.image_url ? (
          <img
            src={scene.image_url}
            alt={scene.scene_title}
            className={`h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] ${
              isRegenerating ? 'opacity-40' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-3 text-center text-xs text-neutral-500">
            Imagen no generada
            {scene.image_error ? (
              <span className="mt-1 block text-[10px] text-neutral-400">
                {scene.image_error}
              </span>
            ) : null}
          </div>
        )}

        <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-brand-pink px-2.5 py-1 text-xs font-bold text-white shadow">
          #{scene.scene_number}
        </span>

        {selectionMode && (
          <span
            aria-hidden="true"
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition ${
              isSelected
                ? 'border-brand-pink bg-brand-pink text-white'
                : 'border-white bg-white/80 text-transparent'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-pink" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
              Regenerando…
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-neutral-900">
          {scene.scene_title}
        </h3>
        <p className="text-xs text-neutral-500">{scene.duration}s</p>
      </div>
    </button>
  );
}
