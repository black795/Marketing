/**
 * Estilos de caption — modelo data-driven 100% (sin clases hardcodeadas).
 *
 * Cada estilo es un objeto que describe tipografía, colores, layout y reglas
 * de highlighting. El render (ffmpeg/libass o un component Remotion) consume
 * este objeto para producir el archivo .ass o el JSX correspondiente.
 *
 * Añadir un estilo nuevo = añadir un objeto a `CAPTION_STYLES`. Nada más.
 */

export type HighlightMode = 'none' | 'karaoke' | 'word-bounce' | 'word-color';

export interface CaptionFont {
  family: string;
  size: number;       // px sobre la altura 1920 (libass escala según PlayResY)
  weight: 400 | 600 | 700 | 800 | 900;
  italic?: boolean;
  letterSpacing?: number;
}

export interface CaptionColors {
  /** Color del texto principal. */
  primary: string;
  /** Color del texto resaltado (palabra activa). */
  highlight: string;
  /** Color del outline. */
  outline: string;
  /** Color del shadow / background opcional. */
  shadow: string;
}

export interface CaptionLayout {
  /** 'bottom' | 'center' | 'top' | 'lower-third'. */
  position: 'top' | 'center' | 'lower-third' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  /** Máx. palabras por línea visible. 0 = sin límite. */
  maxWordsPerLine: number;
  /** Líneas simultáneas en pantalla. */
  maxLines: number;
  /** Margen vertical (px sobre PlayResY). */
  marginV: number;
  marginH: number;
}

export interface CaptionHighlight {
  mode: HighlightMode;
  /** Escala del texto activo (1.0 = igual al resto). */
  scale: number;
  /** Bold de la palabra activa. */
  bold: boolean;
}

export interface CaptionStyle {
  id: string;
  label: string;
  description: string;
  font: CaptionFont;
  colors: CaptionColors;
  layout: CaptionLayout;
  highlight: CaptionHighlight;
  /** Si true, el engine puede insertar emojis al final de las frases clave. */
  autoEmoji: boolean;
  /** Si true, palabras de emphasis se colorean con `colors.highlight`. */
  autoEmphasis: boolean;
  /** Outline thickness en libass units. */
  outlineWidth: number;
  /** Sombra en libass units. */
  shadowDepth: number;
}

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    description: 'Cortes de 2-3 palabras, amarillo sobre blanco, énfasis grande.',
    font: { family: 'Arial Black', size: 80, weight: 900 },
    colors: { primary: '#FFFFFF', highlight: '#FFF466', outline: '#000000', shadow: '#000000' },
    layout: { position: 'center', alignment: 'center', maxWordsPerLine: 3, maxLines: 1, marginV: 600, marginH: 80 },
    highlight: { mode: 'word-color', scale: 1.1, bold: true },
    autoEmoji: true,
    autoEmphasis: true,
    outlineWidth: 6,
    shadowDepth: 0,
  },
  {
    id: 'hormozi',
    label: 'Hormozi',
    description: 'ALL CAPS, amarillo agresivo, max 4 palabras, outline grueso.',
    font: { family: 'Arial Black', size: 96, weight: 900 },
    colors: { primary: '#FFFFFF', highlight: '#FFD700', outline: '#000000', shadow: '#000000' },
    layout: { position: 'center', alignment: 'center', maxWordsPerLine: 4, maxLines: 1, marginV: 700, marginH: 80 },
    highlight: { mode: 'word-color', scale: 1.0, bold: true },
    autoEmoji: false,
    autoEmphasis: true,
    outlineWidth: 8,
    shadowDepth: 2,
  },
  {
    id: 'podcast',
    label: 'Podcast',
    description: '2 líneas, blanco con sombra, lectura cómoda.',
    font: { family: 'Inter', size: 56, weight: 600 },
    colors: { primary: '#FFFFFF', highlight: '#FFFFFF', outline: '#000000', shadow: '#000000' },
    layout: { position: 'lower-third', alignment: 'center', maxWordsPerLine: 6, maxLines: 2, marginV: 280, marginH: 100 },
    highlight: { mode: 'karaoke', scale: 1.0, bold: false },
    autoEmoji: false,
    autoEmphasis: false,
    outlineWidth: 2,
    shadowDepth: 1,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Minimalista — sólo frases clave, sans elegante, sin highlight.',
    font: { family: 'Helvetica Neue', size: 48, weight: 400, letterSpacing: 2 },
    colors: { primary: '#FFFFFF', highlight: '#FFFFFF', outline: '#000000', shadow: '#000000' },
    layout: { position: 'bottom', alignment: 'center', maxWordsPerLine: 8, maxLines: 1, marginV: 200, marginH: 120 },
    highlight: { mode: 'none', scale: 1.0, bold: false },
    autoEmoji: false,
    autoEmphasis: false,
    outlineWidth: 1,
    shadowDepth: 2,
  },
  {
    id: 'documentary',
    label: 'Documentary',
    description: 'Lower-third clásico, blanco con shadow, frase completa.',
    font: { family: 'Georgia', size: 54, weight: 400 },
    colors: { primary: '#FFFFFF', highlight: '#FFFFFF', outline: '#000000', shadow: '#000000' },
    layout: { position: 'lower-third', alignment: 'left', maxWordsPerLine: 0, maxLines: 2, marginV: 240, marginH: 100 },
    highlight: { mode: 'none', scale: 1.0, bold: false },
    autoEmoji: false,
    autoEmphasis: false,
    outlineWidth: 1,
    shadowDepth: 3,
  },
];

export function getCaptionStyle(id: string): CaptionStyle {
  return CAPTION_STYLES.find((s) => s.id === id) ?? CAPTION_STYLES[0];
}
