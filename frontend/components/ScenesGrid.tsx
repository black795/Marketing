'use client';

import type { Scene } from '@/types/story';
import SceneCard from './SceneCard';

interface ScenesGridProps {
  scenes: Scene[];
  selectedSceneNumber?: number | null;
  onSelectScene: (scene: Scene) => void;
}

export default function ScenesGrid({
  scenes,
  selectedSceneNumber,
  onSelectScene,
}: ScenesGridProps) {
  if (scenes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
        No hay escenas todavía.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {scenes.map((scene) => (
        <SceneCard
          key={scene.scene_number}
          scene={scene}
          isActive={selectedSceneNumber === scene.scene_number}
          onClick={onSelectScene}
        />
      ))}
    </div>
  );
}
