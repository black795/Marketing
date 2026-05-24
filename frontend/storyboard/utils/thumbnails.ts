/**
 * Selección del mejor src de preview para una escena.
 *
 * Regla: si hay video con `src` → ese; si no, primera imagen; si no, null.
 * El componente que renderiza decide si pintar `<video>` o `<img>` según
 * el `kind` devuelto.
 */
import type { Scene, SceneAsset } from '@/editing';

export interface ThumbnailSource {
  kind: 'video' | 'image';
  src: string;
}

export function pickThumbnail(scene: Scene): ThumbnailSource | null {
  const video = scene.assets.find(
    (a: SceneAsset) => a.kind === 'video' && !!a.src
  );
  if (video?.src) return { kind: 'video', src: video.src };

  const image = scene.assets.find(
    (a: SceneAsset) => a.kind === 'image' && !!a.src
  );
  if (image?.src) return { kind: 'image', src: image.src };

  return null;
}
