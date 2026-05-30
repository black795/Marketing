/**
 * Catálogo de estilos de subtítulos disponibles. Espejo del catálogo del
 * backend en `services/render.ts > SUBTITLE_STYLES`. El `id` es lo que se
 * guarda en `caption.style` del timeline.
 *
 * El preview es solo orientativo (CSS); el render real lo hace libass.
 */

export interface SubtitleStyleOption {
  id: string;
  label: string;
  description: string;
  preview: {
    bg: string;
    fg: string;
    border?: string;
    fontFamily: string;
    fontWeight: number;
    textTransform?: 'uppercase' | 'none';
    sample: string;
  };
}

export const SUBTITLE_STYLES: SubtitleStyleOption[] = [
  {
    id: 'default',
    label: 'Clásico',
    description: 'Blanco grande con borde negro. Funciona en cualquier video.',
    preview: {
      bg: 'transparent',
      fg: '#ffffff',
      border: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontWeight: 900,
      sample: 'Texto del subtítulo',
    },
  },
  {
    id: 'tiktok-yellow',
    label: 'TikTok',
    description: 'Amarillo brillante con fondo negro semi — viral en Reels y TikTok.',
    preview: {
      bg: 'rgba(0,0,0,0.55)',
      fg: '#FFF400',
      fontFamily: 'Arial Black, sans-serif',
      fontWeight: 900,
      sample: 'Texto TikTok',
    },
  },
  {
    id: 'hormozi-green',
    label: 'Hormozi',
    description: 'Verde Impact en mayúsculas, borde grueso. Estilo Alex Hormozi.',
    preview: {
      bg: 'transparent',
      fg: '#57F542',
      border: '#000000',
      fontFamily: 'Impact, sans-serif',
      fontWeight: 900,
      textTransform: 'uppercase',
      sample: 'TEXTO HORMOZI',
    },
  },
  {
    id: 'mrbeast-white',
    label: 'MrBeast',
    description: 'Blanco gigante con borde negro extra grueso. Pega fuerte.',
    preview: {
      bg: 'transparent',
      fg: '#ffffff',
      border: '#000000',
      fontFamily: 'Impact, sans-serif',
      fontWeight: 900,
      textTransform: 'uppercase',
      sample: 'MR BEAST',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Helvetica blanca chica arriba del frame, sombra sutil.',
    preview: {
      bg: 'transparent',
      fg: '#ffffff',
      fontFamily: 'Helvetica, sans-serif',
      fontWeight: 400,
      sample: 'Texto minimal',
    },
  },
  {
    id: 'highlight',
    label: 'Highlight',
    description: 'Bloque amarillo con texto negro — como un marcador fluo.',
    preview: {
      bg: '#FFF400',
      fg: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontWeight: 900,
      sample: 'Highlight',
    },
  },
  {
    id: 'karaoke',
    label: 'Karaoke',
    description: 'Cyan con borde negro, ideal para letras / canciones.',
    preview: {
      bg: 'transparent',
      fg: '#00E1FF',
      border: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontWeight: 900,
      sample: 'KARAOKE',
    },
  },
];

export const DEFAULT_SUBTITLE_STYLE = 'default';
