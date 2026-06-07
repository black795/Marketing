/**
 * Carousel Generator — tipos backend.
 *
 * Espejo de `frontend/types/carousel.ts`. Definen el contrato de la fase de
 * carruseles. La generación (copy + imágenes por slide) NO está implementada
 * todavía; estos tipos dejan el endpoint preparado para esa etapa.
 */

// Cantidad de carruseles: cualquier entero de 1 a 10 (slider en el front).
export type CarouselCount = number;

export const CAROUSEL_COUNT_MIN = 1;
export const CAROUSEL_COUNT_MAX = 10;

export type CarouselType =
  | 'educativo'
  | 'venta'
  | 'branding'
  | 'storytelling'
  | 'comparativo'
  | 'antes-despues'
  | 'caso-exito';

export type CarouselObjective =
  | 'alcance'
  | 'engagement'
  | 'conversion'
  | 'leads'
  | 'ventas';

export type CarouselPlatform =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok-slides';

export interface CarouselConfig {
  count: CarouselCount;
  type: CarouselType;
  objective: CarouselObjective;
  platform: CarouselPlatform;
  slidesPerCarousel: number;
  productBrief: string;
  styleNote: string;
  /** Handle/usuario que se renderiza al pie de cada slide (ej. "@alanlazarga"). */
  handle?: string;
}

export interface CarouselSlideImageMeta {
  prompt: string;
  model: string;
  quality: string;
  aspectRatio: string;
  referenceKinds: CarouselReferenceKind[];
  referenceCount: number;
  sourceUrl: string | null;
  localPath: string | null;
  createdAt: string;
}

export type CarouselSlideRole = 'cover' | 'content' | 'cta';

export interface CarouselComparisonSide {
  label: string;
  caption: string;
  emoji: string;
  overlayText?: string;
}

export interface CarouselSlide {
  index: number;
  /** Rol editorial del slide: portada (hook), contenido o cierre (CTA). */
  role: CarouselSlideRole;
  /** Titular principal que se renderiza en el slide. */
  headline: string;
  /** Palabra del titular a resaltar con caja de color. */
  highlightWord?: string;
  /** Subtítulo bajo el titular. */
  subheadline?: string;
  /** Copy de apoyo / caption / resumen. */
  body?: string;
  /** Llamada a la acción (slide de cierre). */
  cta?: string;
  /** Estructura comparativa malo/bueno. */
  comparison?: { bad: CarouselComparisonSide; good: CarouselComparisonSide };
  // --- soporte de diseño / compat ---
  visualGoal: string;
  composition: string;
  suggestedText: string;
  /** Prompt de DISEÑO editorial completo para gpt-image-2. */
  imagePrompt: string;
  keyElements: string[];
  imageUrl: string | null;
  imageError?: string;
  imageMeta?: CarouselSlideImageMeta;
}

export interface CarouselImageTarget {
  carouselId: string;
  carouselIndex: number;
  slideIndex: number;
  prompt: string;
  /** Referencias específicas de este slide (data URLs) resueltas de tokens @imageN@. */
  referenceUrls?: string[];
  referenceKinds?: CarouselReferenceKind[];
}

export interface GenerateCarouselImagesRequest {
  projectId?: string | null;
  model?: string;
  quality?: string;
  aspectRatio?: string;
  referenceUrls?: string[];
  referenceKinds?: CarouselReferenceKind[];
  targets: CarouselImageTarget[];
}

export interface CarouselImageResult {
  carouselId: string;
  carouselIndex: number;
  slideIndex: number;
  imageUrl: string | null;
  sourceUrl?: string | null;
  imageError?: string;
  meta?: CarouselSlideImageMeta;
}

export interface Carousel {
  id: string;
  index: number;
  config: CarouselConfig;
  title: string;
  slides: CarouselSlide[];
  createdAt: string;
}

// --- Motor de prompts -------------------------------------------------------

export type CarouselPromptScope =
  | { kind: 'carousel'; carouselIndex: number }
  | { kind: 'slide'; carouselIndex: number; slideIndex: number };

export interface CarouselReferenceSummary {
  productCount: number;
  hasPrincipal: boolean;
  secondaryByKind: Partial<Record<CarouselReferenceKind, number>>;
}

export interface GenerateCarouselPromptsRequest {
  config: CarouselConfig;
  scope: CarouselPromptScope;
  references?: CarouselReferenceSummary;
  projectContext?: string;
  siblingSlides?: CarouselSlide[];
  styleContext?: string;
}

export interface GenerateCarouselPromptsResponse {
  success: boolean;
  carousel?: { title: string; slides: CarouselSlide[] };
  slide?: CarouselSlide;
  error?: string;
}

export type CarouselReferenceKind =
  | 'producto'
  | 'logo'
  | 'branding'
  | 'ejemplo'
  | 'captura'
  | 'mockup';

export interface CarouselReference {
  id: string;
  url: string;
  tipo: CarouselReferenceKind;
  nombre: string;
  fecha: string;
  bytes?: number;
  width?: number;
  height?: number;
}

export interface CarouselReferences {
  principal: CarouselReference[];
  principalId: string | null;
  secundarias: CarouselReference[];
}

export interface GenerateCarouselRequest {
  projectId: string | null;
  config: CarouselConfig;
  scriptId?: string | null;
  sourceImageUrls?: string[];
  /** Referencias visuales para GPT Image 2 (input_images). */
  references?: CarouselReferences;
}

export interface GenerateCarouselResponse {
  success: boolean;
  carousels: Carousel[];
  error?: string;
}

// --- Validación compartida ---------------------------------------------------

const TYPES: CarouselType[] = [
  'educativo',
  'venta',
  'branding',
  'storytelling',
  'comparativo',
  'antes-despues',
  'caso-exito',
];
const OBJECTIVES: CarouselObjective[] = ['alcance', 'engagement', 'conversion', 'leads', 'ventas'];
const PLATFORMS: CarouselPlatform[] = ['instagram', 'linkedin', 'facebook', 'tiktok-slides'];

/**
 * Valida un objeto desconocido como CarouselConfig. Devuelve la config tipada
 * o un mensaje de error (no lanza). La usa la ruta para responder 400 limpio.
 */
export function validateCarouselConfig(
  input: unknown
): { ok: true; config: CarouselConfig } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'config es requerida.' };
  }
  const c = input as Record<string, unknown>;

  const count = Number(c.count);
  if (!Number.isFinite(count) || count < CAROUSEL_COUNT_MIN || count > CAROUSEL_COUNT_MAX) {
    return {
      ok: false,
      error: `count debe estar entre ${CAROUSEL_COUNT_MIN} y ${CAROUSEL_COUNT_MAX}.`,
    };
  }
  if (!TYPES.includes(c.type as CarouselType)) {
    return { ok: false, error: `type inválido. Permitidos: ${TYPES.join(', ')}.` };
  }
  if (!OBJECTIVES.includes(c.objective as CarouselObjective)) {
    return { ok: false, error: `objective inválido. Permitidos: ${OBJECTIVES.join(', ')}.` };
  }
  if (!PLATFORMS.includes(c.platform as CarouselPlatform)) {
    return { ok: false, error: `platform inválida. Permitidas: ${PLATFORMS.join(', ')}.` };
  }
  const slides = Number(c.slidesPerCarousel);
  if (!Number.isFinite(slides) || slides < 2) {
    return { ok: false, error: 'slidesPerCarousel debe ser un número >= 2.' };
  }

  return {
    ok: true,
    config: {
      count: Math.round(count),
      type: c.type as CarouselType,
      objective: c.objective as CarouselObjective,
      platform: c.platform as CarouselPlatform,
      slidesPerCarousel: Math.round(slides),
      productBrief: typeof c.productBrief === 'string' ? c.productBrief : '',
      styleNote: typeof c.styleNote === 'string' ? c.styleNote : '',
      handle: typeof c.handle === 'string' ? c.handle : '',
    },
  };
}
