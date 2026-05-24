'use client';

import { useMemo } from 'react';
import { useStoryboard } from '@/storyboard';
import { pickThumbnail } from '@/storyboard';
import type { StylePack } from '../configs/style-pack';
import { buildPreviewSnapshot } from '../utils/live-preview';

interface Props {
  pack: StylePack;
}

/**
 * Mini-simulación de cómo quedará la primera escena al aplicar el StylePack.
 *
 * Aplica el ColorGrade como filter CSS sobre el thumbnail, vignette+grain
 * como overlays semi-transparentes, y dibuja el caption con el estilo del
 * pack. No persiste nada — es 100% visual.
 */
export default function StyleLivePreview({ pack }: Props) {
  const { state } = useStoryboard();
  const snap = useMemo(() => buildPreviewSnapshot(state.project, pack), [state.project, pack]);

  if (!snap) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-xs text-neutral-400">
        Sin escenas para previsualizar.
      </div>
    );
  }

  const thumb = pickThumbnail(snap.scene);
  const overlayHook = pack.overlays.find((o) =>
    o.injectOnRoles.includes(snap.scene.role)
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Live preview · {pack.emoji} {pack.label}
      </p>

      <div className="relative mx-auto overflow-hidden rounded-md border border-neutral-200 bg-black"
           style={{ aspectRatio: '9 / 16', maxWidth: 220 }}>
        {/* Imagen base con color grade */}
        <div className="absolute inset-0" style={{ filter: snap.cssFilter }}>
          {thumb?.kind === 'video' ? (
            <video src={thumb.src} muted playsInline className="h-full w-full object-cover" />
          ) : thumb?.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
              sin asset
            </div>
          )}
        </div>

        {/* Vignette */}
        {snap.vignetteOpacity > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle, transparent 50%, rgba(0,0,0,${snap.vignetteOpacity}) 100%)`,
            }}
          />
        )}

        {/* Grain (visual approximation) */}
        {snap.grainOpacity > 0 && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{
              opacity: snap.grainOpacity * 1.5,
              backgroundImage:
                'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.06) 0 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.06) 0 1px, transparent 1px)',
              backgroundSize: '3px 3px',
            }}
          />
        )}

        {/* Overlay del hook (si existe) */}
        {overlayHook?.kind === 'text' && (
          <span
            className="absolute font-bold text-white drop-shadow-lg"
            style={{
              left: `${overlayHook.position.x * 100}%`,
              top: `${overlayHook.position.y * 100}%`,
              transform: 'translate(-50%, 0)',
              fontSize: Math.min(28, Number(overlayHook.content.size ?? 48) / 4),
              color: String(overlayHook.content.color ?? '#FFFFFF'),
            }}
          >
            {String(overlayHook.content.text ?? '')}
          </span>
        )}

        {/* Caption (centro-bajo) */}
        <span
          className="absolute left-1/2 bottom-[18%] -translate-x-1/2 whitespace-nowrap text-[18px] font-black uppercase tracking-tight"
          style={snap.captionStyle}
        >
          {snap.captionPreviewText}
        </span>
      </div>

      {/* Detalle de qué cambia */}
      <ul className="space-y-0.5 text-[10px] text-neutral-500">
        <li>
          🎨 Sat <code>{(pack.colorGrade.saturation * 100).toFixed(0)}%</code> · Contr{' '}
          <code>{(pack.colorGrade.contrast * 100).toFixed(0)}%</code>
        </li>
        <li>💬 Animación: {pack.animations.captions.entry} · {pack.animations.captions.perWord}</li>
        <li>🎬 Overlays inyectados: {snap.overlayCount}</li>
        {snap.effectKinds.length > 0 && (
          <li>⚡ Efectos: {snap.effectKinds.join(' · ')}</li>
        )}
        <li>🔊 SFX: {pack.sound.sfxPresetId}</li>
      </ul>
    </div>
  );
}
