/**
 * Exportación de carruseles + adaptadores para integraciones futuras.
 *
 * Prepara los datos de un carrusel en formas que consumen Remotion, el editor
 * de Captions y el Timeline (espejo de types/timeline.ts), SIN acoplarse
 * todavía a esos endpoints. También arma el ZIP de descarga (imágenes +
 * manifest) reutilizando JSZip, igual que DownloadAllImagesButton.
 */
import JSZip from 'jszip';
import type { Carousel } from '@/types/carousel';
import type { TimelineCaption, TimelineClip } from '@/types/timeline';

// ---------------------------------------------------------------------------
// Export neutral (genérico, fácil de mapear a cualquier editor)
// ---------------------------------------------------------------------------

export interface CarouselExportSlide {
  index: number;
  src: string | null;
  /** Texto sugerido → caption. */
  caption: string;
  durationSec: number;
  keyElements: string[];
  imagePrompt: string;
}

export interface CarouselExport {
  id: string;
  title: string;
  aspectRatio: string;
  fps: number;
  slides: CarouselExportSlide[];
}

export function carouselToExport(
  c: Carousel,
  aspectRatio: string,
  opts: { fps?: number; secPerSlide?: number } = {},
): CarouselExport {
  const fps = opts.fps ?? 30;
  const secPerSlide = opts.secPerSlide ?? 3;
  return {
    id: c.id,
    title: c.title,
    aspectRatio,
    fps,
    slides: c.slides.map((s) => ({
      index: s.index,
      src: s.imageUrl,
      caption: s.suggestedText,
      durationSec: secPerSlide,
      keyElements: s.keyElements,
      imagePrompt: s.imagePrompt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Adaptador a Timeline / Remotion / Captions (types/timeline.ts)
// ---------------------------------------------------------------------------

const ASPECT_DIMS: Record<string, [number, number]> = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
  '3:4': [1080, 1440],
  '4:3': [1440, 1080],
};

export function aspectToDims(aspectRatio: string): { width: number; height: number } {
  const [w, h] = ASPECT_DIMS[aspectRatio] ?? [1080, 1350];
  return { width: w, height: h };
}

export interface CarouselTimelineData {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  clips: TimelineClip[];
  captions: TimelineCaption[];
}

/**
 * Convierte un carrusel en clips + captions con el shape de types/timeline.ts.
 * Listo para alimentar Remotion / Captions / Timeline cuando se conecten.
 */
export function carouselToTimeline(
  c: Carousel,
  aspectRatio: string,
  opts: { fps?: number; secPerSlide?: number } = {},
): CarouselTimelineData {
  const fps = opts.fps ?? 30;
  const framesPerSlide = Math.round((opts.secPerSlide ?? 3) * fps);
  const { width, height } = aspectToDims(aspectRatio);

  const clips: TimelineClip[] = [];
  const captions: TimelineCaption[] = [];
  let cursor = 0;

  for (const s of c.slides) {
    clips.push({
      id: `${c.id}-clip-${s.index}`,
      sceneNumber: s.index,
      kind: 'image',
      src: s.imageUrl,
      startFrame: cursor,
      durationFrames: framesPerSlide,
      transitionIn: 'none',
      effects: [],
    });
    if (s.suggestedText) {
      captions.push({
        id: `${c.id}-cap-${s.index}`,
        text: s.suggestedText,
        startFrame: cursor,
        endFrame: cursor + framesPerSlide,
        words: [],
        style: 'default',
      });
    }
    cursor += framesPerSlide;
  }

  return { width, height, fps, durationFrames: cursor, clips, captions };
}

// ---------------------------------------------------------------------------
// Descargas
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'carousel'
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadJson(data: unknown, baseName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(blob, `${slugify(baseName)}-${ts}.json`);
}

function extFromUrlOrType(url: string, contentType: string | null): string {
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  const clean = url.split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot >= 0) {
    const e = clean.slice(dot + 1).toLowerCase();
    if (e.length >= 2 && e.length <= 5) return e;
  }
  return 'png';
}

/**
 * Arma y descarga un ZIP del carrusel: imágenes (en orden) + manifest.json con
 * prompts, textos, elementos clave y metadatos. Reutiliza JSZip (igual patrón
 * que DownloadAllImagesButton). Devuelve cuántas imágenes se incluyeron.
 */
export async function downloadCarouselZip(c: Carousel, aspectRatio: string): Promise<number> {
  const zip = new JSZip();
  const base = `${String(c.index).padStart(2, '0')}-${slugify(c.title)}`;
  const folder = zip.folder(base) ?? zip;
  let included = 0;

  for (const s of c.slides) {
    if (!s.imageUrl) continue;
    try {
      const resp = await fetch(s.imageUrl);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const ext = extFromUrlOrType(s.imageUrl, resp.headers.get('content-type'));
      folder.file(`slide_${String(s.index).padStart(2, '0')}.${ext}`, blob);
      included += 1;
    } catch {
      /* slide sin imagen accesible: se omite del zip */
    }
  }

  const manifest = {
    id: c.id,
    index: c.index,
    title: c.title,
    aspectRatio,
    config: c.config,
    slides: c.slides.map((s) => ({
      index: s.index,
      suggestedText: s.suggestedText,
      visualGoal: s.visualGoal,
      composition: s.composition,
      imagePrompt: s.imagePrompt,
      keyElements: s.keyElements,
      imageMeta: s.imageMeta ?? null,
    })),
    timeline: carouselToTimeline(c, aspectRatio),
  };
  folder.file('manifest.json', JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(zipBlob, `${base}-${ts}.zip`);
  return included;
}
