/**
 * Presets de estética visual (diseño) — compartidos por Scripts y Carruseles.
 *
 * Cada preset es una "dirección de arte" lista para usar: el usuario elige una
 * (Realista, Cartoon, Anime, 3D…) y su `directive` se inyecta en la generación
 * (guion / prompts de carrusel) como bloque de estilo. Es complementario a la
 * Biblioteca de Estilos Visuales (estilos que el usuario guarda él mismo):
 * los presets son el punto de partida rápido; los guardados son a medida.
 */

export interface AestheticPreset {
  id: string;
  /** Etiqueta visible (ES). */
  label: string;
  emoji: string;
  /** Resumen corto para la tarjeta. */
  blurb: string;
  /**
   * Directiva inyectada en el prompt de generación (EN, igual que el resto de
   * prompts). Describe el look para que el motor lo aplique en cada image_prompt.
   */
  directive: string;
}

export const AESTHETIC_PRESETS: AestheticPreset[] = [
  {
    id: 'realistic',
    label: 'Realista',
    emoji: '📷',
    blurb: 'Fotorrealista, luz natural, textura de cámara real.',
    directive:
      'Photorealistic aesthetic: real-camera look, natural lighting, true-to-life skin and material textures, shallow depth of field, candid framing. Avoid any illustrated, plastic or 3D-render feel.',
  },
  {
    id: 'cartoon',
    label: 'Cartoon 2D',
    emoji: '🎨',
    blurb: 'Ilustración 2D, líneas limpias, colores planos vibrantes.',
    directive:
      'Flat 2D cartoon illustration: clean bold outlines, simplified shapes, vibrant flat color fills, minimal shading, playful and friendly. Vector/hand-drawn cartoon look, NOT photoreal.',
  },
  {
    id: 'anime',
    label: 'Anime',
    emoji: '🌸',
    blurb: 'Estilo anime japonés, ojos expresivos, cel-shading.',
    directive:
      'Japanese anime style: expressive large eyes, clean line art, cel-shaded coloring, dramatic lighting and backgrounds, stylized proportions. Modern anime key-visual quality.',
  },
  {
    id: 'pixar3d',
    label: '3D / Pixar',
    emoji: '🧊',
    blurb: 'CGI 3D estilizado, materiales suaves, iluminación de estudio.',
    directive:
      'Stylized 3D CGI render (Pixar/DreamWorks feel): soft rounded forms, subsurface-scattering skin, polished materials, cinematic studio lighting, global illumination, high-detail render.',
  },
  {
    id: 'editorial',
    label: 'Editorial bright',
    emoji: '✨',
    blurb: 'Editorial brillante, fondos limpios, paleta marca.',
    directive:
      'Bright editorial photography: clean studio or minimal backdrop, crisp even lighting, bold brand-color accents, modern magazine composition, generous negative space, premium and aspirational.',
  },
  {
    id: 'cinematic',
    label: 'Cine',
    emoji: '🎬',
    blurb: 'Look cinematográfico, contraste, color grading dramático.',
    directive:
      'Cinematic film look: anamorphic framing, dramatic high-contrast lighting, moody color grading (teal/orange or filmic), film grain, atmospheric depth, wide-screen movie-still quality.',
  },
  {
    id: 'watercolor',
    label: 'Acuarela',
    emoji: '🖌️',
    blurb: 'Pintura en acuarela, bordes suaves, papel texturizado.',
    directive:
      'Watercolor painting style: soft bleeding edges, translucent washes, visible paper texture, organic brush strokes, gentle pastel palette, hand-painted artisanal feel.',
  },
  {
    id: 'comic',
    label: 'Cómic',
    emoji: '💥',
    blurb: 'Cómic occidental, tinta marcada, semitonos.',
    directive:
      'Western comic-book style: heavy ink outlines, halftone dot shading, dynamic action poses, bold primary colors, panel-art energy, graphic-novel illustration.',
  },
  {
    id: 'minimal',
    label: 'Minimalista',
    emoji: '⬜',
    blurb: 'Diseño limpio, mucho espacio, paleta reducida.',
    directive:
      'Minimalist design: lots of negative space, limited 2-3 color palette, simple geometric composition, clean typography-friendly layout, calm and uncluttered, flat or subtle gradients.',
  },
  {
    id: 'retro',
    label: 'Retro / vintage',
    emoji: '📼',
    blurb: 'Estética vintage, grano, paleta cálida desaturada.',
    directive:
      'Retro vintage aesthetic: warm desaturated palette, film grain, light leaks, 70s/80s color treatment, nostalgic analog mood, slightly faded tones.',
  },
];

export function getAestheticPreset(id: string | null | undefined): AestheticPreset | null {
  if (!id) return null;
  return AESTHETIC_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Bloque de contexto que se inyecta en la generación para aplicar la estética.
 * Mismo espíritu que buildProfileContext / buildStyleContext.
 */
export function buildAestheticContext(id: string | null | undefined): string | undefined {
  const preset = getAestheticPreset(id);
  if (!preset) return undefined;
  return `Dirección de arte / estética visual (OBLIGATORIA en cada image_prompt): ${preset.directive}`;
}
