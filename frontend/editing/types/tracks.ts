/**
 * Tracks globales del proyecto — pistas paralelas a las escenas.
 *
 * Las escenas viven en la pista principal de video (`main`), pero overlays,
 * captions y audio pueden vivir en pistas independientes para mute/solo/lock
 * desde la UI del editor.
 */

export type TrackKind = 'video' | 'overlay' | 'caption' | 'audio' | 'sfx';

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  /** Orden visual: menor = arriba en la timeline UI. */
  order: number;
  /** Opacidad/volumen (depende del kind). 0..1. */
  level: number;
}

/** Construye el set mínimo de pistas que cualquier proyecto necesita. */
export function defaultTracks(): Track[] {
  return [
    { id: 'track-main', kind: 'video', name: 'Video principal', muted: false, locked: false, order: 0, level: 1 },
    { id: 'track-overlays', kind: 'overlay', name: 'Overlays', muted: false, locked: false, order: 1, level: 1 },
    { id: 'track-captions', kind: 'caption', name: 'Captions', muted: false, locked: false, order: 2, level: 1 },
    { id: 'track-voice', kind: 'audio', name: 'Voiceover', muted: false, locked: false, order: 3, level: 1 },
    { id: 'track-music', kind: 'audio', name: 'Música', muted: false, locked: false, order: 4, level: 0.6 },
    { id: 'track-sfx', kind: 'sfx', name: 'SFX', muted: false, locked: false, order: 5, level: 0.8 },
  ];
}
