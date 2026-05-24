/**
 * Regenerator de música — añade o reemplaza una pista de música de fondo
 * para esta escena.
 *
 * Como aún no hay catálogo de música subido, el track apunta a una ruta
 * convencional `/assets/music/<packId|default>.mp3` que el usuario llena.
 * El render lo trata como audio source.
 */
import type { Scene, TimelineProject, SceneAudioTrack } from '@/editing';
import { newAudioTrackId } from '@/editing';
import { getStylePack } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateMusic(
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
): Partial<Scene> {
  const packId = scene.stylePresetId ?? project.stylePreset?.id ?? null;
  const pack = packId ? getStylePack(packId) : null;
  const musicVolume = pack?.sound.musicVolume ?? 0.4;
  const trackId = (ctx.options?.musicTrackId as string | undefined) ?? packId ?? 'default';
  const src = `/assets/music/${trackId}.mp3`;

  const nonMusic = scene.audioTracks.filter((t) => t.kind !== 'music');
  const newTrack: SceneAudioTrack = {
    id: newAudioTrackId('music'),
    kind: 'music',
    src,
    startFrame: scene.startFrame,
    durationFrames: scene.durationFrames,
    volume: musicVolume,
    loop: true,
    fadeInFrames: 6,
    fadeOutFrames: 6,
  };
  return { audioTracks: [...nonMusic, newTrack] };
}
