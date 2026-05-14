'use client';

import type { Scene } from '@/types/story';

interface TimelineStripProps {
  scenes: Scene[];
  selectedSceneNumber?: number | null;
  onSelectScene: (scene: Scene) => void;
}

export default function TimelineStrip({
  scenes,
  selectedSceneNumber,
  onSelectScene,
}: TimelineStripProps) {
  if (scenes.length === 0) return null;

  const sorted = [...scenes].sort((a, b) => a.scene_number - b.scene_number);

  return (
    <div className="border-t border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Timeline
          </h3>
          <p className="text-xs text-neutral-400">
            {sorted.length} {sorted.length === 1 ? 'escena' : 'escenas'}
          </p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {sorted.map((scene) => {
            const active = selectedSceneNumber === scene.scene_number;
            return (
              <button
                key={scene.scene_number}
                type="button"
                onClick={() => onSelectScene(scene)}
                aria-label={`Ir a la escena ${scene.scene_number}: ${scene.scene_title}`}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-md border bg-white p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-brand-pink ${
                  active
                    ? 'border-brand-pink ring-2 ring-brand-pink'
                    : 'border-neutral-200 hover:border-brand-pink'
                }`}
              >
                <div
                  className="overflow-hidden rounded-sm bg-neutral-100"
                  style={{ width: '54px', aspectRatio: '9 / 16' }}
                >
                  {scene.image_url ? (
                    <img
                      src={scene.image_url}
                      alt={scene.scene_title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">
                      n/a
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-neutral-800">
                  #{scene.scene_number}
                </span>
                <span className="text-[10px] text-neutral-500">
                  {scene.duration}s
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
