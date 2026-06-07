'use client';

import { useMemo } from 'react';
import type { Scene } from '@/editing';
import { pickThumbnail } from '@/storyboard';

interface Props {
  scene: Scene;
  /** Estilo CSS (filter) inferido del color-grade — opcional. */
  cssFilter?: string;
}

/**
 * Preview rápido de una escena — render CSS-only.
 *
 * Es la representación más barata posible: thumbnail con filter + captions
 * sobreimpresos. Para preview "real" (compilado server-side) hay que llamar
 * al endpoint de render con `presetId` ad-hoc y mostrarlo cuando llegue.
 *
 * Se expone aquí como módulo para que otros editores lo embeban sin
 * acoplarse al Storyboard ni al Style Engine.
 */
export default function ScenePreviewRenderer({ scene, cssFilter }: Props) {
  const thumb = useMemo(() => pickThumbnail(scene), [scene]);
  const caption = scene.captions[0]?.text ?? '';

  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-md bg-black"
      style={{ filter: cssFilter }}
    >
      {thumb?.kind === 'video' ? (
        <video src={thumb.src} muted playsInline className="h-full w-full object-cover" />
      ) : thumb?.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--fg-3)]">
          sin preview
        </div>
      )}
      {caption && (
        <p className="absolute inset-x-2 bottom-4 text-center text-sm font-black uppercase text-white drop-shadow-lg">
          {caption.split(/\s+/).slice(0, 5).join(' ')}
        </p>
      )}
    </div>
  );
}
