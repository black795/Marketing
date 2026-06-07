import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { OUTPUT_ROOT } from './video-persistence';
import type { CarouselSlideImageMeta } from '../types/carousel';

const PUBLIC_BASE_URL = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';

function safe(s: string | null | undefined): string {
  return (s ?? 'default').replace(/[^\w\-.]/g, '_');
}

function extFromContentType(ct: string | null): string {
  if (!ct) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  return 'png';
}

export interface PersistedCarouselImage {
  /** URL servida estáticamente (o el data:/source URL si no se pudo persistir). */
  url: string;
  /** Ruta estática relativa (null si no se persistió a disco). */
  staticPath: string | null;
  absolutePath: string | null;
}

/**
 * Descarga la imagen de una slide a
 * `assets/output/<projectId>/carousels/c<NN>/slide_<MM>.<ext>`.
 *
 * Si `imageUrl` es un data: URL (p. ej. sandbox) NO toca disco y la devuelve
 * tal cual. Lanza si la descarga http falla — el caller decide el fallback.
 */
export async function persistCarouselImage(params: {
  imageUrl: string;
  projectId: string | null;
  carouselIndex: number;
  slideIndex: number;
}): Promise<PersistedCarouselImage> {
  // data: URLs (sandbox) — no se persisten a disco, se devuelven directo.
  if (params.imageUrl.startsWith('data:')) {
    return { url: params.imageUrl, staticPath: null, absolutePath: null };
  }

  const projectId = safe(params.projectId);
  const cDir = `c${String(params.carouselIndex).padStart(2, '0')}`;
  const dir = path.join(OUTPUT_ROOT, projectId, 'carousels', cDir);
  await mkdir(dir, { recursive: true });

  const resp = await fetch(params.imageUrl);
  if (!resp.ok || !resp.body) {
    throw new Error(
      `Persist: download falló para C${params.carouselIndex}/S${params.slideIndex}: HTTP ${resp.status}`,
    );
  }

  const ext = extFromContentType(resp.headers.get('content-type'));
  const file = `slide_${String(params.slideIndex).padStart(2, '0')}.${ext}`;
  const absolutePath = path.join(dir, file);

  await pipeline(Readable.fromWeb(resp.body as any), createWriteStream(absolutePath));

  const staticPath = `/assets/output/${projectId}/carousels/${cDir}/${file}`;
  return { url: `${PUBLIC_BASE_URL}${staticPath}`, staticPath, absolutePath };
}

/**
 * Escribe los metadatos de la slide (prompt utilizado, referencias, modelo…)
 * junto a la imagen, como `slide_<MM>.json`. Falla silenciosa: la persistencia
 * de metadatos no debe romper la generación.
 */
export async function writeCarouselSlideMeta(params: {
  projectId: string | null;
  carouselIndex: number;
  slideIndex: number;
  meta: CarouselSlideImageMeta;
}): Promise<string | null> {
  try {
    const projectId = safe(params.projectId);
    const cDir = `c${String(params.carouselIndex).padStart(2, '0')}`;
    const dir = path.join(OUTPUT_ROOT, projectId, 'carousels', cDir);
    await mkdir(dir, { recursive: true });
    const file = `slide_${String(params.slideIndex).padStart(2, '0')}.json`;
    const abs = path.join(dir, file);
    await writeFile(abs, JSON.stringify(params.meta, null, 2), 'utf-8');
    return `/assets/output/${projectId}/carousels/${cDir}/${file}`;
  } catch {
    return null;
  }
}
