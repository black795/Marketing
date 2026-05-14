import type { GenerateStoryResponse, Scene } from '@/types/story';

interface ResponsePreviewProps {
  data: GenerateStoryResponse | null;
}

function SceneImage({ scene }: { scene: Scene }) {
  if (scene.image_url) {
    return (
      <img
        src={scene.image_url}
        alt={scene.scene_title}
        className="mt-2 max-w-xs rounded-md border border-neutral-200 shadow-sm"
      />
    );
  }

  return (
    <p className="mt-2 inline-block rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
      ⚠ Imagen no generada
      {scene.image_error ? `: ${scene.image_error}` : ''}
    </p>
  );
}

export default function ResponsePreview({ data }: ResponsePreviewProps) {
  if (!data) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-400">
        La respuesta aparecerá aquí
      </div>
    );
  }

  const scenes = data.scenes ?? [];

  return (
    <div className="space-y-4">
      {scenes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-700">
            Escenas ({scenes.length})
          </h3>
          {scenes.map((scene) => (
            <div
              key={scene.scene_number}
              className="rounded-md border border-neutral-200 bg-white p-3"
            >
              <p className="text-sm font-semibold">
                {scene.scene_number}. {scene.scene_title}
              </p>
              <SceneImage scene={scene} />
            </div>
          ))}
        </div>
      )}

      <details className="rounded-md border border-neutral-200 bg-neutral-900 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-neutral-300">
          Ver JSON crudo
        </summary>
        <pre className="mt-2 overflow-auto text-xs leading-relaxed text-green-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
