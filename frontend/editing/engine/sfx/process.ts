/**
 * Materializa las inserciones de SFX como `SceneAudioTrack` en la escena.
 *
 * No duplica: si la escena ya tenía un SFX track del mismo `sfxId`, lo
 * sobreescribe (mismo id) en lugar de añadir uno nuevo.
 */
import type { Scene, SceneAudioTrack } from '../../types/scene';
import type { SfxInsertion } from './analyze';
import { getSfx } from './library';
import { newAudioTrackId } from '../../utils/ids';

export function applySfxToScene(
  scene: Scene,
  insertions: SfxInsertion[]
): Scene {
  const filtered = insertions.filter((i) => i.sceneId === scene.id);
  if (filtered.length === 0) return scene;

  // Mantenemos los audio tracks no-SFX intactos.
  const nonSfx = scene.audioTracks.filter((a) => a.kind !== 'sfx');
  const previousSfx = scene.audioTracks.filter((a) => a.kind === 'sfx');

  const newTracks: SceneAudioTrack[] = [];
  const seen = new Set<string>();

  for (const ins of filtered) {
    if (seen.has(ins.sfxId)) continue;
    seen.add(ins.sfxId);
    const entry = getSfx(ins.sfxId);
    if (!entry) continue;
    // Reusar id si ya estaba.
    const existing = previousSfx.find((p) => p.src === entry.src);
    newTracks.push({
      id: existing?.id ?? newAudioTrackId('sfx'),
      kind: 'sfx',
      src: entry.src,
      startFrame: scene.startFrame + ins.atFrame,
      durationFrames: entry.durationFrames,
      volume: ins.volume,
    });
  }

  return {
    ...scene,
    audioTracks: [...nonSfx, ...newTracks],
  };
}
