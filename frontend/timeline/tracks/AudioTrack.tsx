'use client';

import type { Scene, SceneAudioTrack } from '@/editing';
import { useTimelineUi } from '../store/context';
import { framesToPx, MIN_CLIP_PX } from '../utils/pixels';
import { TRACK_METAS, type TimelineTrackKind } from '../types/ui';
import TrackRow from './TrackRow';
import Waveform from '../components/Waveform';
import { isInRange } from '../utils/virtualization';

interface Props {
  kind: Extract<TimelineTrackKind, 'voice' | 'music' | 'sfx'>;
  /** Subkind del audio track del scene graph que mapea esta pista. */
  audioKind: SceneAudioTrack['kind'];
  scenes: Scene[];
  widthPx: number;
  heightPx: number;
  visibleRange: { start: number; end: number };
}

/**
 * Pista de audio (voz / música / sfx). Pinta UN bloque por cada
 * `SceneAudioTrack` cuyo `kind` matchea. La voz extra "sintética" se infiere
 * de los captions cuando no hay audio track explícito.
 */
export default function AudioTrack({
  kind,
  audioKind,
  scenes,
  widthPx,
  heightPx,
  visibleRange,
}: Props) {
  const { ui } = useTimelineUi();
  const meta = TRACK_METAS.find((m) => m.id === kind)!;
  const muted = ui.mutedTracks.includes(kind);

  return (
    <TrackRow widthPx={widthPx} heightPx={heightPx} tone={muted ? 'muted' : 'default'}>
      {scenes.flatMap((scene) => {
        // 1) Audio tracks reales del scene graph.
        const blocks = scene.audioTracks
          .filter((t) => t.kind === audioKind)
          .map((t) => renderBlock(scene, t.startFrame, t.durationFrames, t.id, t.volume, ui.pxPerFrame, heightPx, meta.color, visibleRange, kind === 'voice'));

        // 2) Voz sintética para escenas con captions pero sin voice track explícito.
        if (
          audioKind === 'voiceover' &&
          scene.captions.length > 0 &&
          !scene.audioTracks.some((t) => t.kind === 'voiceover')
        ) {
          blocks.push(
            renderBlock(
              scene,
              scene.startFrame,
              scene.durationFrames,
              `synth-voice-${scene.id}`,
              0.0, // 0 = sintético / informativo (no se renderiza)
              ui.pxPerFrame,
              heightPx,
              `${meta.color} opacity-40`,
              visibleRange,
              true
            )
          );
        }
        return blocks;
      })}
    </TrackRow>
  );
}

function renderBlock(
  scene: Scene,
  startFrame: number,
  durationFrames: number,
  key: string,
  volume: number,
  pxPerFrame: number,
  heightPx: number,
  color: string,
  visibleRange: { start: number; end: number },
  drawWaveform: boolean
) {
  const xPx = framesToPx(startFrame, pxPerFrame);
  const widthPx = Math.max(framesToPx(durationFrames, pxPerFrame), MIN_CLIP_PX);
  const visible = isInRange(startFrame, startFrame + durationFrames, visibleRange);
  return (
    <div
      key={key}
      className={`absolute top-1 rounded-md ${color}`}
      style={{ left: xPx, width: widthPx, height: heightPx - 8 }}
      title={`vol ${(volume * 100).toFixed(0)}%`}
    >
      <div className="pointer-events-none h-full w-full px-1">
        {drawWaveform ? (
          <Waveform
            scene={scene}
            widthPx={widthPx}
            barColor="bg-[var(--bg-2)]/80"
            visible={visible}
          />
        ) : null}
      </div>
    </div>
  );
}
