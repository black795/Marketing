'use client';

import type { Scene } from '@/editing';
import { useTimelineUi } from '../store/context';
import { framesToPx } from '../utils/pixels';
import { TRACK_METAS } from '../types/ui';
import TrackRow from './TrackRow';

const META = TRACK_METAS.find((m) => m.id === 'effects')!;

/**
 * Pista de efectos / cámara — markers visuales por escena.
 *
 * Muestra para cada escena: preset de cámara + lista de effects (kind),
 * en un solo bloque del ancho de la escena. No es interactivo (los efectos
 * se editan desde el panel de la escena).
 */
export default function EffectsTrack({
  scenes,
  widthPx,
  heightPx,
}: {
  scenes: Scene[];
  widthPx: number;
  heightPx: number;
}) {
  const { ui } = useTimelineUi();
  return (
    <TrackRow widthPx={widthPx} heightPx={heightPx}>
      {scenes.map((scene) => {
        const xPx = framesToPx(scene.startFrame, ui.pxPerFrame);
        const widthPx = framesToPx(scene.durationFrames, ui.pxPerFrame);
        const cam = scene.camera?.preset;
        const fx = scene.effects.map((e) => e.kind).join(' · ');
        const label = [cam, fx].filter(Boolean).join(' · ');
        if (!label) return null;
        return (
          <div
            key={scene.id}
            className={`absolute top-1 overflow-hidden rounded-md border border-white/30 px-1.5 py-0.5 text-[10px] font-semibold text-white ${META.color}`}
            style={{ left: xPx, width: Math.max(widthPx, 32), height: heightPx - 8 }}
            title={label}
          >
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </TrackRow>
  );
}
