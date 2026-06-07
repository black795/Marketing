/**
 * Cliente del motor de PROMPTS de carrusel + cache.
 *
 * Genera/regenera prompts (texto) vía el backend. NO genera imágenes.
 *
 * Cache: los carruseles generados se guardan por (firma de inputs + índice) en
 * sessionStorage. Así, si el usuario vuelve atrás o re-entra a la pantalla de
 * revisión con la misma config, no se vuelve a llamar a Claude. Regenerar
 * fuerza el bypass y sobrescribe la entrada.
 */
import type {
  CarouselConfig,
  CarouselReferenceSummary,
  CarouselSlide,
  GenerateCarouselPromptsResponse,
} from '@/types/carousel';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Cache (sessionStorage + memoria)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'koda-os:carousel-prompts-cache';

type CachedCarousel = { title: string; slides: CarouselSlide[] };
type CacheShape = Record<string, CachedCarousel>;

let mem: CacheShape | null = null;

function loadCache(): CacheShape {
  if (mem) return mem;
  if (typeof window === 'undefined') return (mem = {});
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    mem = raw ? (JSON.parse(raw) as CacheShape) : {};
  } catch {
    mem = {};
  }
  return mem;
}

function saveCache(): void {
  if (typeof window === 'undefined' || !mem) return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(mem));
  } catch {
    /* sessionStorage lleno/deshabilitado: ignorar */
  }
}

function cacheKey(signature: string, carouselIndex: number): string {
  return `${signature}::c${carouselIndex}`;
}

export function getCachedCarousel(signature: string, carouselIndex: number): CachedCarousel | null {
  return loadCache()[cacheKey(signature, carouselIndex)] ?? null;
}

function setCachedCarousel(signature: string, carouselIndex: number, value: CachedCarousel): void {
  const c = loadCache();
  c[cacheKey(signature, carouselIndex)] = value;
  saveCache();
}

/** Limpia toda la cache de prompts (p. ej. al cambiar de proyecto). */
export function clearCarouselPromptCache(): void {
  mem = {};
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Llamadas al backend
// ---------------------------------------------------------------------------

async function postPrompts(
  body: unknown,
  signal?: AbortSignal,
): Promise<GenerateCarouselPromptsResponse> {
  const res = await fetch(`${BACKEND_URL}/api/generate-carousel-prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = `Backend respondió ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(detail);
  }
  return (await res.json()) as GenerateCarouselPromptsResponse;
}

/**
 * Genera (o devuelve de cache) un carrusel completo por índice.
 * @param force salta la cache y regenera.
 */
export async function generateCarousel(
  params: {
    config: CarouselConfig;
    carouselIndex: number;
    signature: string;
    references?: CarouselReferenceSummary;
    projectContext?: string;
    styleContext?: string;
    force?: boolean;
  },
  options: { signal?: AbortSignal } = {},
): Promise<CachedCarousel> {
  if (!params.force) {
    const hit = getCachedCarousel(params.signature, params.carouselIndex);
    if (hit) return hit;
  }

  const resp = await postPrompts(
    {
      config: params.config,
      scope: { kind: 'carousel', carouselIndex: params.carouselIndex },
      references: params.references,
      projectContext: params.projectContext,
      styleContext: params.styleContext,
    },
    options.signal,
  );
  if (!resp.success || !resp.carousel) {
    throw new Error(resp.error || 'No se pudo generar el carrusel');
  }
  setCachedCarousel(params.signature, params.carouselIndex, resp.carousel);
  return resp.carousel;
}

/** Regenera UNA slide (siempre bypassa cache). Devuelve la slide nueva. */
export async function regenerateSlide(
  params: {
    config: CarouselConfig;
    carouselIndex: number;
    slideIndex: number;
    references?: CarouselReferenceSummary;
    projectContext?: string;
    styleContext?: string;
    siblingSlides?: CarouselSlide[];
  },
  options: { signal?: AbortSignal } = {},
): Promise<CarouselSlide> {
  const resp = await postPrompts(
    {
      config: params.config,
      scope: { kind: 'slide', carouselIndex: params.carouselIndex, slideIndex: params.slideIndex },
      references: params.references,
      projectContext: params.projectContext,
      styleContext: params.styleContext,
      siblingSlides: params.siblingSlides,
    },
    options.signal,
  );
  if (!resp.success || !resp.slide) {
    throw new Error(resp.error || 'No se pudo regenerar la slide');
  }
  return resp.slide;
}

/** Sobrescribe la entrada de cache de un carrusel (tras editar/regenerar). */
export function updateCachedCarousel(
  signature: string,
  carouselIndex: number,
  value: CachedCarousel,
): void {
  setCachedCarousel(signature, carouselIndex, value);
}
