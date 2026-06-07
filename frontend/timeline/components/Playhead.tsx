'use client';

import { useStoryboard } from '@/storyboard';
import { useTimelineUi } from '../store/context';
import { framesToPx } from '../utils/pixels';
import { framesToMmSs } from '@/editing';

interface Props {
  /** Altura visible en px (cubre ruler + todas las tracks). */
  heightPx: number;
}

export default function Playhead({ heightPx }: Props) {
  const { ui } = useTimelineUi();
  const { state: sb } = useStoryboard();
  const xPx = framesToPx(ui.playheadFrame, ui.pxPerFrame);
  return (
    <div
      className="pointer-events-none absolute top-0 z-20"
      style={{ left: xPx, height: heightPx }}
    >
      <div className="h-full w-[2px] bg-[var(--red)]" />
      <div className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-[var(--red)]" />
      <span className="absolute top-3.5 left-1.5 rounded bg-[var(--red)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
        {framesToMmSs(ui.playheadFrame, sb.project.renderConfig.fps)}
      </span>
    </div>
  );
}
