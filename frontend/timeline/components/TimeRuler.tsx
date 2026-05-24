'use client';

import { useMemo } from 'react';
import { useStoryboard } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import { framesToPx } from '../utils/pixels';
import { framesToMmSs } from '@/editing';

interface Props {
  widthPx: number;
}

const ROLE_COLOR: Record<string, string> = {
  hook: 'bg-brand-pink/60',
  intro: 'bg-brand-yellow/70',
  body: 'bg-neutral-300',
  cta: 'bg-emerald-500/70',
  outro: 'bg-neutral-600',
  transition: 'bg-violet-500/70',
};

/**
 * Top ruler: bandas de color por sección de escena + marcas de segundos +
 * texto de tiempo. La barra es clickeable (el caller cablea el scrub).
 */
export default function TimeRuler({ widthPx }: Props) {
  const { state: sb } = useStoryboard();
  const { ui } = useTimelineUi();
  const fps = sb.project.renderConfig.fps;

  // Marcas: cada segundo. Si pxPerFrame es muy bajo, agrupamos cada 2s o 5s.
  const tickEverySec = useMemo(() => {
    const pxPerSec = ui.pxPerFrame * fps;
    if (pxPerSec < 30) return 5;
    if (pxPerSec < 60) return 2;
    return 1;
  }, [ui.pxPerFrame, fps]);

  const totalFrames = sb.project.metadata.durationFrames;
  const ticks = [];
  for (let s = 0; s * fps <= totalFrames; s += tickEverySec) {
    const xPx = framesToPx(s * fps, ui.pxPerFrame);
    ticks.push({ s, xPx });
  }

  return (
    <div
      className="relative h-9 select-none border-b border-neutral-200 bg-neutral-50"
      style={{ width: widthPx }}
    >
      {/* Scene Sections: bandas por rol */}
      <div className="absolute inset-x-0 top-0 h-3">
        {sb.project.scenes.map((s) => {
          if (!s.included) return null;
          const x = framesToPx(s.startFrame, ui.pxPerFrame);
          const w = framesToPx(s.durationFrames, ui.pxPerFrame);
          return (
            <div
              key={s.id}
              className={`absolute top-0 h-3 ${ROLE_COLOR[s.role] ?? 'bg-neutral-200'}`}
              style={{ left: x, width: w }}
              title={`${s.role} · escena ${s.sceneNumber}`}
            />
          );
        })}
      </div>

      {/* Marcas de tiempo */}
      <div className="absolute inset-x-0 bottom-0 h-6">
        {ticks.map(({ s, xPx }) => (
          <div key={s} className="absolute bottom-0 flex flex-col items-start" style={{ left: xPx }}>
            <span className="block h-2 w-px bg-neutral-400" aria-hidden />
            <span className="px-1 font-mono text-[10px] text-neutral-500">
              {framesToMmSs(s * fps, fps)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
