import { Router, Request, Response } from 'express';
import { generateImage } from '../services/python-worker/imageWorker';
import { persistCarouselImage, writeCarouselSlideMeta } from '../services/carousel-persistence';
import { openSseStream } from '../services/sse';
import { runWebResearch, stripWebSearchMarkers } from '../services/webSearch';
import { createLogger, newId } from '../services/logger';
import { metrics } from '../services/metrics';
import type {
  CarouselImageResult,
  CarouselImageTarget,
  CarouselReferenceKind,
  CarouselSlideImageMeta,
  GenerateCarouselImagesRequest,
} from '../types/carousel';

/**
 * Generación REAL de imágenes de carrusel con GPT Image 2.
 *
 *   POST /api/generate-carousel-images?stream=1
 *
 * Reutiliza la integración existente (services/python-worker/imageWorker →
 * Python worker /generate-image → API/gpt_image_2.py). NO crea otra integración.
 *
 * - Recibe `targets` (slide + prompt aprobado) + referencias (data URLs).
 * - Genera con paralelismo acotado (CAROUSEL_IMAGE_CONCURRENCY, default 3).
 * - Persiste cada imagen + metadatos (prompt y referencias utilizadas).
 * - Emite estado/progreso/errores por SSE; cancelación vía desconexión.
 *
 * El front llama este endpoint con los targets de UN slide, UN carrusel o
 * TODOS — el backend trata todos igual (una lista de targets).
 */
const router = Router();
const log = createLogger('carousel-images');

// Nombre de wire reconocido por el worker (MODEL_NAME_MAP). 'gpt-image-2' NO
// existe ahí y se rechaza con 400 antes de llegar a Replicate.
const DEFAULT_MODEL = process.env.CAROUSEL_IMAGE_MODEL || 'chatgpt-image-2';
const CONCURRENCY = Math.max(1, Number(process.env.CAROUSEL_IMAGE_CONCURRENCY) || 3);

router.post('/generate-carousel-images', async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string) || newId('req');
  const jobId = newId('job');
  const routeLog = log.child({ requestId, jobId });

  const body = (req.body || {}) as GenerateCarouselImagesRequest;
  const targets = Array.isArray(body.targets) ? body.targets : [];
  const model = typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;
  const quality = body.quality || 'standard';
  const aspectRatio = body.aspectRatio || '4:5';
  const referenceUrls = Array.isArray(body.referenceUrls)
    ? body.referenceUrls.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const referenceKinds = Array.isArray(body.referenceKinds)
    ? (body.referenceKinds as CarouselReferenceKind[])
    : [];

  // -------- Validación --------
  const valid = targets.filter(
    (t): t is CarouselImageTarget =>
      !!t &&
      typeof t.carouselId === 'string' &&
      typeof t.carouselIndex === 'number' &&
      typeof t.slideIndex === 'number' &&
      typeof t.prompt === 'string' &&
      t.prompt.trim().length > 0,
  );
  if (valid.length === 0) {
    return res.status(400).json({ success: false, error: 'No hay targets válidos (slide + prompt).' });
  }

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/event-stream'));

  routeLog.info(
    `inicio model=${model} targets=${valid.length} refs=${referenceUrls.length} ` +
      `concurrency=${CONCURRENCY} stream=${wantsStream}`,
  );

  const abort = new AbortController();

  // Ejecuta un target: genera (reusa imageWorker con retries) + persiste + meta.
  async function runTarget(t: CarouselImageTarget): Promise<CarouselImageResult> {
    const sceneId = `c${t.carouselIndex}-s${t.slideIndex}`;
    // Referencias por-slide (tokens @imageN@) tienen prioridad sobre las del batch.
    const tRefUrls =
      Array.isArray(t.referenceUrls) && t.referenceUrls.length > 0 ? t.referenceUrls : referenceUrls;
    const tRefKinds =
      Array.isArray(t.referenceKinds) && t.referenceKinds.length > 0
        ? (t.referenceKinds as CarouselReferenceKind[])
        : referenceKinds;

    // Marcas marcadas con * en el prompt → datos reales de la web (compacto)
    // anexados al prompt de imagen. Los marcadores se limpian igual.
    const research = await runWebResearch([t.prompt], { compact: true, label: 'carousel-img' });
    let prompt = stripWebSearchMarkers(t.prompt);
    if (research.contextBlock) prompt = `${prompt}\n\n${research.contextBlock}`;

    const gen = await generateImage({
      model,
      prompt,
      quality,
      aspectRatio,
      referenceImageUrls: tRefUrls.length > 0 ? tRefUrls : undefined,
      abortSignal: abort.signal,
      logContext: { requestId, jobId, sceneId },
    });

    metrics.imageGenerations += 1;
    if (!gen.image_url) {
      metrics.imageGenerationFailures += 1;
      return {
        carouselId: t.carouselId,
        carouselIndex: t.carouselIndex,
        slideIndex: t.slideIndex,
        imageUrl: null,
        imageError: gen.image_error || 'Generación fallida',
      };
    }

    // Persistir a disco (best-effort: si falla, usamos la URL del proveedor).
    let finalUrl = gen.image_url;
    let localPath: string | null = null;
    try {
      const persisted = await persistCarouselImage({
        imageUrl: gen.image_url,
        projectId: body.projectId ?? null,
        carouselIndex: t.carouselIndex,
        slideIndex: t.slideIndex,
      });
      finalUrl = persisted.url;
      localPath = persisted.staticPath;
    } catch (err) {
      routeLog.warn(`no se pudo persistir C${t.carouselIndex}/S${t.slideIndex}, uso URL del proveedor`, {
        sceneId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const meta: CarouselSlideImageMeta = {
      prompt,
      model,
      quality,
      aspectRatio,
      referenceKinds: tRefKinds,
      referenceCount: tRefUrls.length,
      sourceUrl: gen.image_url,
      localPath,
      createdAt: new Date().toISOString(),
    };
    await writeCarouselSlideMeta({
      projectId: body.projectId ?? null,
      carouselIndex: t.carouselIndex,
      slideIndex: t.slideIndex,
      meta,
    });

    return {
      carouselId: t.carouselId,
      carouselIndex: t.carouselIndex,
      slideIndex: t.slideIndex,
      imageUrl: finalUrl,
      sourceUrl: gen.image_url,
      meta,
    };
  }

  // ====================================================================
  // SSE
  // ====================================================================
  if (wantsStream) {
    const sse = openSseStream(res, {
      label: 'generate-carousel-images',
      context: { requestId, jobId },
      onClientDisconnect: () => {
        metrics.cancellations += 1;
        routeLog.warn('cancelación REAL: cliente desconectado — abortando job');
        abort.abort();
      },
    });

    sse.send({ event: 'start', data: { total: valid.length, model, concurrency: CONCURRENCY, requestId, jobId } });

    const results: CarouselImageResult[] = [];
    let nextIndex = 0;
    let done = 0;

    // Pool de workers: cada uno toma el siguiente target disponible.
    async function worker(): Promise<void> {
      while (true) {
        if (abort.signal.aborted) return;
        const i = nextIndex++;
        if (i >= valid.length) return;
        const t = valid[i];

        sse.send({
          event: 'slide-start',
          data: { carouselId: t.carouselId, carouselIndex: t.carouselIndex, slideIndex: t.slideIndex },
        });

        const result = await runTarget(t);
        results.push(result);
        done += 1;

        sse.send({
          event: result.imageError ? 'slide-error' : 'slide-done',
          data: { result, done, total: valid.length, progress: done / valid.length },
        });
      }
    }

    const pool = Array.from({ length: Math.min(CONCURRENCY, valid.length) }, () => worker());
    await Promise.all(pool);

    if (sse.isClientGone() || abort.signal.aborted) {
      sse.send({ event: 'cancelled', data: { completed: done, total: valid.length, results } });
    } else {
      const failed = results.filter((r) => !r.imageUrl).length;
      routeLog.info(`job terminado total=${results.length} failed=${failed}`);
      sse.send({ event: 'done', data: { success: true, results, failed } });
    }
    sse.close();
    return;
  }

  // ====================================================================
  // JSON (compat / sin streaming) — también paraleliza.
  // ====================================================================
  const results: CarouselImageResult[] = [];
  let nextIndex = 0;
  async function workerJson(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= valid.length) return;
      results.push(await runTarget(valid[i]));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, valid.length) }, () => workerJson()),
  );
  const failed = results.filter((r) => !r.imageUrl).length;
  return res.status(200).json({ success: true, results, failed, requestId });
});

export default router;
