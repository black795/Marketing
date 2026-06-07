/**
 * Cliente de generación de IMÁGENES de carrusel (GPT Image 2) vía SSE.
 *
 * Reutiliza `parseSseStream` del cliente de imágenes existente (lib/api). El
 * backend reusa a su vez la integración de imágenes actual. NO duplica nada.
 */
import { parseSseStream, StreamCancelledError } from './api';
import type {
  CarouselImageResult,
  CarouselImageTarget,
  CarouselReferenceKind,
} from '@/types/carousel';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface CarouselImagesCallbacks {
  onStart?: (info: { total: number; model: string; concurrency: number }) => void;
  onSlideStart?: (info: { carouselId: string; carouselIndex: number; slideIndex: number }) => void;
  onSlide?: (result: CarouselImageResult) => void;
}

export interface CarouselImagesOutcome {
  status: 'done' | 'cancelled';
  results: CarouselImageResult[];
  failed: number;
}

export interface CarouselImagesPayload {
  projectId?: string | null;
  model?: string;
  quality?: string;
  aspectRatio?: string;
  referenceUrls?: string[];
  referenceKinds?: CarouselReferenceKind[];
  targets: CarouselImageTarget[];
}

/**
 * Genera imágenes para una lista de slides (UN slide, UN carrusel o TODOS — es
 * el caller quien arma `targets`). Emite progreso por callback. Lanza
 * StreamCancelledError si se aborta antes de recibir un cierre del backend.
 */
export async function streamGenerateCarouselImages(
  payload: CarouselImagesPayload,
  callbacks: CarouselImagesCallbacks,
  signal: AbortSignal,
): Promise<CarouselImagesOutcome> {
  if (signal.aborted) throw new StreamCancelledError();

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/generate-carousel-images?stream=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw new StreamCancelledError();
    throw err;
  }

  if (!response.ok || !response.body) {
    throw new Error(`Backend respondió ${response.status}`);
  }

  const byKey = new Map<string, CarouselImageResult>();
  let status: 'done' | 'cancelled' = 'cancelled';
  let failed = 0;

  const key = (r: CarouselImageResult) => `${r.carouselId}:${r.slideIndex}`;

  try {
    for await (const { event, data } of parseSseStream(response.body)) {
      switch (event) {
        case 'start':
          callbacks.onStart?.({ total: data.total, model: data.model, concurrency: data.concurrency });
          break;
        case 'slide-start':
          callbacks.onSlideStart?.({
            carouselId: data.carouselId,
            carouselIndex: data.carouselIndex,
            slideIndex: data.slideIndex,
          });
          break;
        case 'slide-done':
        case 'slide-error': {
          const r = data.result as CarouselImageResult;
          byKey.set(key(r), r);
          callbacks.onSlide?.(r);
          break;
        }
        case 'cancelled':
          status = 'cancelled';
          if (Array.isArray(data?.results)) {
            for (const r of data.results as CarouselImageResult[]) byKey.set(key(r), r);
          }
          break;
        case 'done':
          status = 'done';
          failed = Number(data?.failed ?? 0);
          if (Array.isArray(data?.results)) {
            for (const r of data.results as CarouselImageResult[]) byKey.set(key(r), r);
          }
          break;
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw new StreamCancelledError();
    throw err;
  }

  const results = Array.from(byKey.values());
  return { status, results, failed };
}
