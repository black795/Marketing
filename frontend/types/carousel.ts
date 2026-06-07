/**
 * Carousel Generator — estructura de datos de la fase de carruseles.
 *
 * Fase intermedia entre la generación del contenido principal (storyboard /
 * video) y la fase de edición (styles). Toma el guion/escenas ya generados y
 * deja al usuario configurar uno o varios carruseles antes de mandarlos a
 * generar.
 *
 * IMPORTANTE: este archivo define SOLO la estructura de datos y los tipos. La
 * generación real (texto + imágenes por slide) se implementa en un paso
 * posterior. Los tipos Request/Response quedan preparados para esa etapa.
 */

// ---------------------------------------------------------------------------
// 1. Cantidad de carruseles
// ---------------------------------------------------------------------------

// Cantidad de carruseles: cualquier valor entero de 1 a 10 (slider).
export type CarouselCount = number;

export const CAROUSEL_COUNT_MIN = 1;
export const CAROUSEL_COUNT_MAX = 10;

export const CAROUSEL_COUNTS: CarouselCount[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function clampCarouselCount(n: number): CarouselCount {
  if (Number.isNaN(n)) return CAROUSEL_COUNT_MIN;
  return Math.min(CAROUSEL_COUNT_MAX, Math.max(CAROUSEL_COUNT_MIN, Math.round(n)));
}

// ---------------------------------------------------------------------------
// 2. Tipo de carrusel
// ---------------------------------------------------------------------------

export type CarouselType =
  | 'educativo'
  | 'venta'
  | 'branding'
  | 'storytelling'
  | 'comparativo'
  | 'antes-despues'
  | 'caso-exito';

export interface CarouselTypeOption {
  id: CarouselType;
  label: string;
  description: string;
  /** Cantidad de slides por defecto sugerida para este tipo narrativo. */
  defaultSlides: number;
}

export const CAROUSEL_TYPES: CarouselTypeOption[] = [
  {
    id: 'educativo',
    label: 'Educativo',
    description: 'Enseña un concepto paso a paso. Cada slide = una idea.',
    defaultSlides: 7,
  },
  {
    id: 'venta',
    label: 'Venta',
    description: 'Presenta un producto/servicio y lleva a la acción de compra.',
    defaultSlides: 6,
  },
  {
    id: 'branding',
    label: 'Branding',
    description: 'Refuerza identidad, tono y valores de la marca.',
    defaultSlides: 5,
  },
  {
    id: 'storytelling',
    label: 'Storytelling',
    description: 'Narra una historia con arco emocional (inicio → giro → cierre).',
    defaultSlides: 8,
  },
  {
    id: 'comparativo',
    label: 'Comparativo',
    description: 'Confronta dos opciones, enfoques o productos lado a lado.',
    defaultSlides: 6,
  },
  {
    id: 'antes-despues',
    label: 'Antes y después',
    description: 'Muestra una transformación: estado inicial vs. resultado.',
    defaultSlides: 4,
  },
  {
    id: 'caso-exito',
    label: 'Caso de éxito',
    description: 'Testimonio o resultado real con datos y prueba social.',
    defaultSlides: 6,
  },
];

// ---------------------------------------------------------------------------
// 3. Objetivo
// ---------------------------------------------------------------------------

export type CarouselObjective =
  | 'alcance'
  | 'engagement'
  | 'conversion'
  | 'leads'
  | 'ventas';

export interface CarouselObjectiveOption {
  id: CarouselObjective;
  label: string;
  description: string;
}

export const CAROUSEL_OBJECTIVES: CarouselObjectiveOption[] = [
  { id: 'alcance', label: 'Alcance', description: 'Maximizar visualizaciones y descubrimiento.' },
  { id: 'engagement', label: 'Engagement', description: 'Likes, guardados, comentarios y compartidos.' },
  { id: 'conversion', label: 'Conversión', description: 'Empujar una acción concreta (clic, registro).' },
  { id: 'leads', label: 'Leads', description: 'Capturar contactos / interesados.' },
  { id: 'ventas', label: 'Ventas', description: 'Cerrar la compra del producto o servicio.' },
];

// ---------------------------------------------------------------------------
// 4. Plataforma
// ---------------------------------------------------------------------------

export type CarouselPlatform =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok-slides';

export interface CarouselPlatformOption {
  id: CarouselPlatform;
  label: string;
  /** Relación de aspecto recomendada para las slides en esta plataforma. */
  aspectRatio: string;
  /** Máximo de slides que admite la plataforma. */
  maxSlides: number;
  /** Rango recomendado [min, max] de slides. */
  recommendedSlides: [number, number];
}

export const CAROUSEL_PLATFORMS: CarouselPlatformOption[] = [
  { id: 'instagram', label: 'Instagram', aspectRatio: '4:5', maxSlides: 10, recommendedSlides: [5, 8] },
  { id: 'linkedin', label: 'LinkedIn', aspectRatio: '1:1', maxSlides: 20, recommendedSlides: [6, 12] },
  { id: 'facebook', label: 'Facebook', aspectRatio: '1:1', maxSlides: 10, recommendedSlides: [4, 8] },
  { id: 'tiktok-slides', label: 'TikTok Slides', aspectRatio: '9:16', maxSlides: 35, recommendedSlides: [5, 10] },
];

// ---------------------------------------------------------------------------
// Configuración de la fase (lo que el usuario arma en la pantalla)
// ---------------------------------------------------------------------------

export interface CarouselConfig {
  /** Cuántos carruseles generar. */
  count: CarouselCount;
  /** Tipo narrativo de cada carrusel. */
  type: CarouselType;
  /** Objetivo de marketing. */
  objective: CarouselObjective;
  /** Plataforma destino (define aspect ratio y límites de slides). */
  platform: CarouselPlatform;
  /** Slides por carrusel (deriva de plataforma/tipo; editable más adelante). */
  slidesPerCarousel: number;
  /** Qué producto/tema es (describe el sujeto del carrusel). */
  productBrief: string;
  /** Estilo visual deseado (look, tono, paleta). Opcional. */
  styleNote: string;
  /** Preset de estética (Realista/Cartoon/…) aplicado. Opcional. */
  aestheticId?: string | null;
  /** Handle/usuario que se renderiza al pie de cada slide (ej. "@alanlazarga"). Opcional. */
  handle?: string;
}

export const DEFAULT_CAROUSEL_CONFIG: CarouselConfig = {
  count: 3,
  type: 'educativo',
  objective: 'engagement',
  platform: 'instagram',
  slidesPerCarousel: 7,
  productBrief: '',
  styleNote: '',
  aestheticId: null,
  handle: '',
};

// ---------------------------------------------------------------------------
// Referencias visuales (lo que se enviará a GPT Image 2 como input_images)
// ---------------------------------------------------------------------------

/** Rol de la referencia dentro del carrusel. */
export type CarouselReferenceRole = 'principal' | 'secundaria';

/**
 * Categoría de cada imagen de referencia.
 *   - `producto`: imágenes del producto (referencias principales).
 *   - secundarias: logo / branding / ejemplo / captura / mockup.
 */
export type CarouselReferenceKind =
  | 'producto'
  | 'logo'
  | 'branding'
  | 'ejemplo'
  | 'captura'
  | 'mockup';

export interface CarouselReferenceKindOption {
  id: CarouselReferenceKind;
  label: string;
  role: CarouselReferenceRole;
  description: string;
}

/** Categorías secundarias seleccionables al subir referencias de apoyo. */
export const CAROUSEL_SECONDARY_KINDS: CarouselReferenceKindOption[] = [
  { id: 'logo', label: 'Logo', role: 'secundaria', description: 'Logotipo de la marca.' },
  { id: 'branding', label: 'Branding', role: 'secundaria', description: 'Paleta, tipografías, guías visuales.' },
  { id: 'ejemplo', label: 'Ejemplo visual', role: 'secundaria', description: 'Referencia de estilo o inspiración.' },
  { id: 'captura', label: 'Captura', role: 'secundaria', description: 'Screenshot de app, web o resultado.' },
  { id: 'mockup', label: 'Mockup', role: 'secundaria', description: 'Maqueta del producto en contexto.' },
];

/**
 * Una imagen de referencia. Campos mínimos requeridos: id, url, tipo, nombre,
 * fecha. Las dimensiones/bytes son metadata opcional para la UI.
 */
export interface CarouselReference {
  id: string;
  /** data: URL — lo que se manda a GPT Image 2 como imagen de referencia. */
  url: string;
  /** Categoría de la referencia. */
  tipo: CarouselReferenceKind;
  /** Nombre original del archivo. */
  nombre: string;
  /** Fecha de carga (ISO 8601). */
  fecha: string;
  /** Metadata tras el resize en cliente (opcional). */
  bytes?: number;
  width?: number;
  height?: number;
}

/** Conjunto completo de referencias de la fase. */
export interface CarouselReferences {
  /** Imágenes del producto (referencia principal). */
  principal: CarouselReference[];
  /** id de la imagen del producto marcada como principal. */
  principalId: string | null;
  /** Referencias secundarias (logo, branding, ejemplo, captura, mockup). */
  secundarias: CarouselReference[];
}

export const EMPTY_CAROUSEL_REFERENCES: CarouselReferences = {
  principal: [],
  principalId: null,
  secundarias: [],
};

/** Límites del uploader de referencias del carrusel. */
export const CAROUSEL_REFERENCE_LIMITS = {
  /** Máximo de imágenes de producto (principales). */
  maxPrincipal: 10,
  /** Máximo de referencias secundarias. */
  maxSecundarias: 15,
  /** Lado más largo tras el resize cliente, en px. */
  maxSidePx: 1280,
  /** Tamaño máximo del archivo original aceptado (bytes). */
  maxBytes: 12 * 1024 * 1024,
} as const;

/**
 * Aplana las referencias en el orden con el que se mandarán a GPT Image 2 como
 * `input_images`: primero la principal seleccionada, luego el resto de las
 * principales, luego las secundarias (en su orden). Devuelve data: URLs.
 *
 * NO genera nada — solo arma el array listo para el siguiente paso.
 */
export function buildGptImageReferenceUrls(refs: CarouselReferences): string[] {
  const main = refs.principal.find((r) => r.id === refs.principalId);
  const restPrincipal = refs.principal.filter((r) => r.id !== refs.principalId);
  const ordered: CarouselReference[] = [
    ...(main ? [main] : []),
    ...restPrincipal,
    ...refs.secundarias,
  ];
  return ordered.map((r) => r.url);
}

// ---------------------------------------------------------------------------
// Artefactos generados (preparados; se llenan en la fase de generación)
// ---------------------------------------------------------------------------

/** Metadatos de una imagen generada para una slide. */
export interface CarouselSlideImageMeta {
  /** Prompt exacto enviado a GPT Image 2. */
  prompt: string;
  model: string;
  quality: string;
  aspectRatio: string;
  /** Tipo de cada referencia utilizada, en el orden en que se enviaron. */
  referenceKinds: CarouselReferenceKind[];
  referenceCount: number;
  /** URL original del proveedor (puede expirar). */
  sourceUrl: string | null;
  /** Ruta estática local persistida (servida por el backend). */
  localPath: string | null;
  createdAt: string;
}

/** Rol del slide dentro de la narrativa editorial del carrusel. */
export type CarouselSlideRole = 'cover' | 'content' | 'cta';

/** Un lado de un slide comparativo (malo 👻 vs bueno ⭐). */
export interface CarouselComparisonSide {
  /** Título corto del lado (ej. "Mostrar solo el producto"). */
  label: string;
  /** Caption en cursiva debajo de la foto (ej. "Se siente como un anuncio molesto"). */
  caption: string;
  /** Emoji/acento del lado: 👻 para el malo, ⭐ para el bueno. */
  emoji: string;
  /** Texto que va SOBRE la foto del lado (ej. "DIFERENCIAS ENTRE…"). Opcional. */
  overlayText?: string;
}

/**
 * Una slide individual dentro de un carrusel EDITORIAL.
 *
 * El carrusel es copy-driven: lo que importa es el TEXTO y el layout. El
 * `imagePrompt` instruye a gpt-image-2 a renderizar el slide completo (fondo,
 * titular con palabra resaltada, emojis, fotos incrustadas, captions, handle)
 * usando los campos de copy de abajo.
 */
export interface CarouselSlide {
  /** Posición 1..N dentro del carrusel. */
  index: number;
  /** Rol editorial: portada (hook), contenido o cierre (CTA). */
  role: CarouselSlideRole;
  /** Titular principal que se renderiza en el slide. Es el texto que importa. */
  headline: string;
  /** Palabra del titular a resaltar con caja de color (acento de marca). Opcional. */
  highlightWord?: string;
  /** Subtítulo bajo el titular (ej. "(Y cuáles subir en su lugar)"). Opcional. */
  subheadline?: string;
  /** Copy de apoyo / caption / resumen. Opcional. */
  body?: string;
  /** Llamada a la acción (típicamente solo el slide de cierre). Opcional. */
  cta?: string;
  /** Estructura comparativa malo/bueno (tipos comparativo / antes-despues). Opcional. */
  comparison?: { bad: CarouselComparisonSide; good: CarouselComparisonSide };
  // --- soporte de diseño / compatibilidad ---
  /** Objetivo visual: qué debe lograr/comunicar la slide. */
  visualGoal: string;
  /** Composición: encuadre, layout, jerarquía visual. */
  composition: string;
  /** Resumen del texto del slide (legacy / preview en listas). */
  suggestedText: string;
  /** Prompt de DISEÑO editorial completo para gpt-image-2 (renderiza todo el slide). */
  imagePrompt: string;
  /** Elementos clave a incluir (producto, logo, props, etc.). */
  keyElements: string[];
  /** URL de la imagen una vez generada (local persistida; null hasta entonces). */
  imageUrl: string | null;
  /** Error de la última generación de imagen, si falló. */
  imageError?: string;
  /** Metadatos de la imagen generada (prompt + referencias utilizadas, etc.). */
  imageMeta?: CarouselSlideImageMeta;
}

/** Un carrusel completo generado. */
export interface Carousel {
  id: string;
  /** Posición 1..N del carrusel dentro del set. */
  index: number;
  /** Snapshot de la config con la que se generó. */
  config: CarouselConfig;
  /** Título / gancho principal del carrusel. */
  title: string;
  slides: CarouselSlide[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Motor de generación de PROMPTS (texto). Imágenes NO se generan todavía.
// ---------------------------------------------------------------------------

/** Alcance de una generación de prompts. */
export type CarouselPromptScope =
  | { kind: 'carousel'; carouselIndex: number }
  | { kind: 'slide'; carouselIndex: number; slideIndex: number };

/** Resumen textual de las referencias (no se mandan data URLs a Claude). */
export interface CarouselReferenceSummary {
  productCount: number;
  hasPrincipal: boolean;
  secondaryByKind: Partial<Record<CarouselReferenceKind, number>>;
}

export interface GenerateCarouselPromptsRequest {
  config: CarouselConfig;
  scope: CarouselPromptScope;
  /** Resumen de referencias disponibles (para que Claude las contemple). */
  references?: CarouselReferenceSummary;
  /** Contexto extra del proyecto (p. ej. título/estilo del guion). */
  projectContext?: string;
  /** Para scope 'slide': las slides ya existentes del carrusel (contexto). */
  siblingSlides?: CarouselSlide[];
  /** Contexto de un estilo visual guardado a imitar (buildStyleContext). */
  styleContext?: string;
}

export interface GenerateCarouselPromptsResponse {
  success: boolean;
  /** Para scope 'carousel': el carrusel generado (sin id, lo asigna el cliente). */
  carousel?: { title: string; slides: CarouselSlide[] };
  /** Para scope 'slide': la slide regenerada. */
  slide?: CarouselSlide;
  error?: string;
}

// ---------------------------------------------------------------------------
// Generación de IMÁGENES (GPT Image 2 vía el worker existente).
// ---------------------------------------------------------------------------

/**
 * Modelo de imagen usado para los carruseles (override por env en backend).
 * Debe coincidir con el nombre de wire que reconoce el worker de Python
 * (MODEL_NAME_MAP en workers/python/app/routes/generate_image.py): es
 * `chatgpt-image-2`, NO `gpt-image-2` (este último lo rechaza con 400).
 */
export const CAROUSEL_IMAGE_MODEL = 'chatgpt-image-2';

/** Una slide concreta a generar (referencia + prompt ya resueltos). */
export interface CarouselImageTarget {
  carouselId: string;
  carouselIndex: number;
  slideIndex: number;
  prompt: string;
  /**
   * Referencias específicas de ESTE slide (data URLs), resueltas desde tokens
   * @imageN@ en el prompt. Si está presente, el backend usa SOLO estas para el
   * slide (en vez de las referencias del batch). Opcional.
   */
  referenceUrls?: string[];
  referenceKinds?: CarouselReferenceKind[];
}

export interface GenerateCarouselImagesRequest {
  projectId?: string | null;
  model?: string;
  quality?: string;
  aspectRatio?: string;
  /** Referencias (data URLs) ordenadas: producto (principal primero) + secundarias. */
  referenceUrls?: string[];
  /** Tipo de cada referencia, en paralelo a referenceUrls (para metadatos). */
  referenceKinds?: CarouselReferenceKind[];
  targets: CarouselImageTarget[];
}

/** Resultado de generar la imagen de UNA slide. */
export interface CarouselImageResult {
  carouselId: string;
  carouselIndex: number;
  slideIndex: number;
  imageUrl: string | null;
  sourceUrl?: string | null;
  imageError?: string;
  meta?: CarouselSlideImageMeta;
}

/** Una referencia aplanada con su posición 1-based para el token @imageN@. */
export interface FlatCarouselReference {
  url: string;
  kind: CarouselReferenceKind;
  /** Etiqueta corta legible (ej. "producto principal", "logo"). */
  label: string;
  /** Nombre original del archivo (para la UI). */
  nombre: string;
  /** Posición 1-based — es el número N del token @imageN@. */
  index: number;
}

/**
 * Aplana las referencias en el MISMO orden en que se mandan al modelo
 * (producto principal → resto de productos → secundarias), con etiqueta y un
 * índice 1-based que es el número que el usuario usa en @imageN@.
 */
export function flattenCarouselReferences(refs: CarouselReferences): FlatCarouselReference[] {
  const main = refs.principal.find((r) => r.id === refs.principalId);
  const restPrincipal = refs.principal.filter((r) => r.id !== refs.principalId);
  const ordered: CarouselReference[] = [
    ...(main ? [main] : []),
    ...restPrincipal,
    ...refs.secundarias,
  ];
  return ordered.map((r, i) => ({
    url: r.url,
    kind: r.tipo,
    label: r.tipo === 'producto' ? (i === 0 && main ? 'producto principal' : 'producto') : r.tipo,
    nombre: r.nombre,
    index: i + 1,
  }));
}

/** Aplana las referencias con sus tipos, en el orden que se mandan al modelo. */
export function buildGptImageReferenceInputs(
  refs: CarouselReferences,
): { urls: string[]; kinds: CarouselReferenceKind[] } {
  const flat = flattenCarouselReferences(refs);
  return { urls: flat.map((f) => f.url), kinds: flat.map((f) => f.kind) };
}

/** Resultado de resolver los tokens @imageN@ de un prompt de slide. */
export interface ResolvedImageTokens {
  /** Prompt con los tokens reemplazados por una referencia en lenguaje natural. */
  prompt: string;
  /** URLs de las imágenes referenciadas, en orden de aparición (deduplicadas). */
  urls: string[];
  kinds: CarouselReferenceKind[];
  /** True si el prompt usó al menos un token válido. */
  used: boolean;
}

/** Token de referencia: @image1@, @image@1, @img2@, @imagen3@ (case-insensitive). */
export const CAROUSEL_IMAGE_TOKEN_RE = /@(?:image|imagen|img)@?(\d+)@?/gi;

/**
 * Reemplaza los tokens @imageN@ del prompt por un puntero en lenguaje natural
 * ("reference image #K (label)") y devuelve SOLO las imágenes referenciadas, en
 * el orden en que aparecen. K es la posición de envío real (no el N del token),
 * para que el modelo cuente las input_images en el mismo orden que las recibe.
 */
export function resolveCarouselImageTokens(
  prompt: string,
  flat: FlatCarouselReference[],
): ResolvedImageTokens {
  const order: number[] = []; // índices 1-based dentro de flat, en orden de aparición
  const rewritten = prompt.replace(CAROUSEL_IMAGE_TOKEN_RE, (_m, numStr: string) => {
    const srcIdx = parseInt(numStr, 10);
    const item = flat[srcIdx - 1];
    if (!item) return ''; // índice fuera de rango → quitar token
    let pos = order.indexOf(srcIdx);
    if (pos === -1) {
      order.push(srcIdx);
      pos = order.length - 1;
    }
    return `reference image #${pos + 1} (${item.label})`;
  });
  // rewritten === prompt cuando no hubo tokens; si hubo tokens inválidos, los
  // quita (mejor que mandar "@image9@" literal al modelo).
  return {
    prompt: rewritten,
    urls: order.map((i) => flat[i - 1].url),
    kinds: order.map((i) => flat[i - 1].kind),
    used: order.length > 0,
  };
}

/** Construye el resumen de referencias para mandar a Claude. */
export function summarizeReferences(refs: CarouselReferences): CarouselReferenceSummary {
  const secondaryByKind: Partial<Record<CarouselReferenceKind, number>> = {};
  for (const r of refs.secundarias) {
    secondaryByKind[r.tipo] = (secondaryByKind[r.tipo] ?? 0) + 1;
  }
  return {
    productCount: refs.principal.length,
    hasPrincipal: refs.principalId != null,
    secondaryByKind,
  };
}

/**
 * Firma estable de los inputs que afectan a los prompts. Si no cambia, los
 * prompts cacheados siguen siendo válidos (no hace falta regenerar).
 * No incluye las data URLs (pesadas e irrelevantes para el texto).
 */
export function carouselPromptSignature(
  config: CarouselConfig,
  refs: CarouselReferences,
): string {
  const refSig = {
    principal: refs.principal.map((r) => r.id),
    principalId: refs.principalId,
    secundarias: refs.secundarias.map((r) => `${r.tipo}:${r.id}`),
  };
  return JSON.stringify({ config, refSig });
}

// ---------------------------------------------------------------------------
// Contrato con el backend (PREPARADO — sin implementar la generación todavía)
// ---------------------------------------------------------------------------

export interface GenerateCarouselRequest {
  projectId: string | null;
  config: CarouselConfig;
  /** Guion de origen (si se generó en la fase de Scripts). */
  scriptId?: string | null;
  /** Imágenes ya generadas que pueden reutilizarse como base visual. */
  sourceImageUrls?: string[];
  /** Referencias visuales (producto + secundarias) para GPT Image 2. */
  references?: CarouselReferences;
}

export interface GenerateCarouselResponse {
  success: boolean;
  carousels: Carousel[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getPlatformOption(id: CarouselPlatform): CarouselPlatformOption {
  return CAROUSEL_PLATFORMS.find((p) => p.id === id) ?? CAROUSEL_PLATFORMS[0];
}

export function getTypeOption(id: CarouselType): CarouselTypeOption {
  return CAROUSEL_TYPES.find((t) => t.id === id) ?? CAROUSEL_TYPES[0];
}

/**
 * Ajusta `slidesPerCarousel` al rango válido de la plataforma. Útil cuando el
 * usuario cambia de plataforma o de tipo y hay que re-encajar el valor.
 */
export function clampSlides(slides: number, platform: CarouselPlatform): number {
  const opt = getPlatformOption(platform);
  return Math.max(2, Math.min(opt.maxSlides, Math.round(slides)));
}
