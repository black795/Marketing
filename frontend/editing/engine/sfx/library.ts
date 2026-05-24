/**
 * Catálogo de SFX disponibles. Cada entrada es metadata + ruta del archivo.
 *
 * Los archivos físicos viven en `assets/sfx/<id>.mp3`. Si todavía no existen,
 * el engine sigue añadiendo entradas a `scene.audioTracks` con la URL prevista;
 * el render reportará el error si el archivo falta, y el usuario sube los
 * SFX cuando esté listo. Esto desacopla diseño del scene graph de la
 * disponibilidad de los assets.
 */

export type SfxKind = 'whoosh' | 'impact' | 'glitch' | 'bass-hit' | 'transition' | 'riser';

export interface SfxEntry {
  id: string;
  label: string;
  kind: SfxKind;
  /** Path relativo bajo /assets/sfx. */
  src: string;
  /** Duración aproximada en frames @30fps. */
  durationFrames: number;
  /** Volumen sugerido 0..1. */
  defaultVolume: number;
  description: string;
}

export const SFX_LIBRARY: SfxEntry[] = [
  {
    id: 'whoosh',
    label: 'Whoosh',
    kind: 'whoosh',
    src: '/assets/sfx/whoosh.mp3',
    durationFrames: 12,
    defaultVolume: 0.55,
    description: 'Barrido aéreo — transiciones rápidas.',
  },
  {
    id: 'impact',
    label: 'Impact',
    kind: 'impact',
    src: '/assets/sfx/impact.mp3',
    durationFrames: 9,
    defaultVolume: 0.6,
    description: 'Golpe seco — puntuar revelaciones.',
  },
  {
    id: 'glitch',
    label: 'Glitch',
    kind: 'glitch',
    src: '/assets/sfx/glitch.mp3',
    durationFrames: 10,
    defaultVolume: 0.5,
    description: 'Glitch digital — cortes urgentes / errores.',
  },
  {
    id: 'bass-hit',
    label: 'Bass hit',
    kind: 'bass-hit',
    src: '/assets/sfx/bass-hit.mp3',
    durationFrames: 14,
    defaultVolume: 0.7,
    description: 'Golpe grave — drops, intros de hook.',
  },
  {
    id: 'transition',
    label: 'Transición',
    kind: 'transition',
    src: '/assets/sfx/transition.mp3',
    durationFrames: 18,
    defaultVolume: 0.5,
    description: 'Genérico para cualquier transición.',
  },
  {
    id: 'riser',
    label: 'Riser',
    kind: 'riser',
    src: '/assets/sfx/riser.mp3',
    durationFrames: 45,
    defaultVolume: 0.5,
    description: 'Tensión que sube — preámbulos al hook.',
  },
];

export function getSfx(id: string | null | undefined): SfxEntry | null {
  if (!id) return null;
  return SFX_LIBRARY.find((s) => s.id === id) ?? null;
}
