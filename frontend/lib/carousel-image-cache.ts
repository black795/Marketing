/**
 * Cache inteligente de imágenes de carrusel.
 *
 * Clave = firma de (prompt + referencias). Si una imagen ya se generó para esa
 * combinación exacta, se reutiliza en vez de llamar de nuevo a GPT Image 2.
 * Persistida en sessionStorage, así sobrevive a navegaciones dentro de la
 * sesión. Es un acelerador opcional: el project-store sigue siendo la fuente de
 * verdad de la UI.
 */
import type { CarouselSlideImageMeta } from '@/types/carousel';

const CACHE_KEY = 'koda-os:carousel-image-cache';

export interface CachedImage {
  imageUrl: string;
  meta?: CarouselSlideImageMeta;
}

type CacheShape = Record<string, CachedImage>;

let mem: CacheShape | null = null;

function load(): CacheShape {
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

function save(): void {
  if (typeof window === 'undefined' || !mem) return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(mem));
  } catch {
    /* sessionStorage lleno: ignorar (cache es best-effort) */
  }
}

/** Hash FNV-1a corto y barato (no cripto). */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Firma de la imagen de una slide. Usa el prompt completo + un resumen de las
 * referencias (cantidad + un hash de su contenido recortado) para no hashear
 * data URLs gigantes enteras.
 */
export function computeImageSig(prompt: string, referenceUrls: string[]): string {
  const refDigest = referenceUrls.map((u) => `${u.length}:${u.slice(0, 64)}`).join('|');
  return `${hashString(prompt)}~${referenceUrls.length}~${hashString(refDigest)}`;
}

export function getCachedImage(sig: string): CachedImage | null {
  return load()[sig] ?? null;
}

export function setCachedImage(sig: string, value: CachedImage): void {
  const c = load();
  c[sig] = value;
  save();
}

export function clearCarouselImageCache(): void {
  mem = {};
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}
