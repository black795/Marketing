import { Router, Request, Response } from 'express';
import { openSseStream } from '../services/sse';
import { createLogger, newId } from '../services/logger';
import { metrics } from '../services/metrics';
import { persistCaptionedVideo } from '../services/video-persistence';
import { getProvider } from '../services/captions/registry';
import { getCaptionsConfig, resolveProviderKey } from '../services/captions/store';
import { CaptionsNotImplementedError } from '../services/captions/types';

/**
 * Captions Editor — fase 2.
 *
 * POST /api/captions/job  (SSE)
 *   Toma un video terminado (videoUrl), lo envía al proveedor de captions
 *   activo con una plantilla de estilo, polea el progreso y devuelve el
 *   video subtitulado (persistido localmente).
 *
 * El flujo completo —submit → poll → fetch resultado— vive en el backend;
 * la API key nunca toca el frontend.
 */

const router = Router();
const log = createLogger('caption-job');

/** La API de captions acepta videos de hasta 50 MB. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const POLL_INTERVAL_MS = 4_000;
/** Tope de seguridad para no polear indefinidamente. */
const POLL_MAX_MS = 12 * 60_000;

interface CaptionJobBody {
  videoUrl?: string;
  captionTemplateId?: string;
}

/** Espera abortable: resuelve a los `ms` o si el signal se dispara. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

router.post('/captions/job', async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string) || newId('req');
  const jobId = newId('capjob');
  const routeLog = log.child({ requestId, jobId });

  const body = req.body as CaptionJobBody;
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  const captionTemplateId =
    typeof body.captionTemplateId === 'string' ? body.captionTemplateId.trim() : '';

  // ---------------- Validación ----------------
  if (!videoUrl) {
    return res.status(400).json({
      success: false,
      error: 'Falta "videoUrl" (el video a subtitular)',
      requestId,
    });
  }
  if (!captionTemplateId) {
    return res.status(400).json({
      success: false,
      error: 'Falta "captionTemplateId" (la plantilla de estilo)',
      requestId,
    });
  }

  // Resolver proveedor + key (backend only).
  const cfg = getCaptionsConfig();
  const provider = getProvider(cfg.activeProvider);
  if (!provider) {
    return res.status(400).json({
      success: false,
      error: 'No hay un proveedor de captions activo válido',
      requestId,
    });
  }
  if (!cfg.captionsEnabled) {
    return res.status(400).json({
      success: false,
      error: 'Las captions están desactivadas en ⚙️ Configuración de APIs',
      requestId,
    });
  }
  if (!provider.info.implemented) {
    return res.status(400).json({
      success: false,
      error: `El proveedor "${provider.info.label}" todavía no está implementado`,
      requestId,
    });
  }
  const apiKey = resolveProviderKey(cfg.activeProvider);
  if (provider.info.requiresApiKey && !apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Falta la API key del proveedor. Configúrala en ⚙️ Configuración de APIs.',
      requestId,
    });
  }

  routeLog.info(
    `inicio provider=${cfg.activeProvider} template=${captionTemplateId} video=${videoUrl}`
  );

  // ---------------- Stream SSE ----------------
  const startedAt = Date.now();
  const abort = new AbortController();
  const sse = openSseStream(res, {
    label: 'caption-job',
    context: { requestId, jobId },
    onClientDisconnect: () => {
      metrics.cancellations += 1;
      routeLog.warn('cancelación REAL: el cliente cerró la conexión — abortando');
      abort.abort();
    },
  });

  const fail = (error: string) => {
    routeLog.error(`job fallido: ${error}`);
    sse.send({ event: 'error', data: { jobId, error } });
    sse.close();
  };

  sse.send({
    event: 'start',
    data: { jobId, requestId, provider: cfg.activeProvider, captionTemplateId },
  });

  try {
    // --- 1. Descargar el video de origen ---
    sse.send({
      event: 'status',
      data: { phase: 'uploading', progress: null, message: 'Descargando el video de origen…' },
    });

    const srcRes = await fetch(videoUrl, { signal: abort.signal });
    if (!srcRes.ok) {
      return fail(`No se pudo descargar el video de origen (HTTP ${srcRes.status})`);
    }
    const videoBytes = Buffer.from(await srcRes.arrayBuffer());
    if (videoBytes.length > MAX_VIDEO_BYTES) {
      return fail(
        `El video pesa ${(videoBytes.length / 1048576).toFixed(1)} MB — el máximo de la API es 50 MB.`
      );
    }
    if (abort.signal.aborted) {
      sse.send({ event: 'cancelled', data: { jobId } });
      return sse.close();
    }
    routeLog.info(`video descargado (${(videoBytes.length / 1048576).toFixed(1)} MB)`);

    // --- 2. Enviar el job de captioning ---
    sse.send({
      event: 'status',
      data: {
        phase: 'submitting',
        progress: null,
        message: 'Enviando el video al proveedor de captions…',
      },
    });

    const filename = videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
    const submitted = await provider.submitCaptionJob(
      {
        apiKey: apiKey || '',
        captionTemplateId,
        videoBytes,
        videoFilename: filename.toLowerCase().endsWith('.mp4')
          ? filename
          : `${filename}.mp4`,
      },
      abort.signal
    );
    routeLog.info(`job aceptado por el proveedor providerJobId=${submitted.id}`);

    // --- 3. Polling del estado ---
    let job = submitted;
    while (job.status === 'processing') {
      if (abort.signal.aborted || sse.isClientGone()) {
        routeLog.warn('job cancelado durante el polling');
        sse.send({ event: 'cancelled', data: { jobId } });
        return sse.close();
      }
      if (Date.now() - startedAt > POLL_MAX_MS) {
        return fail('Timeout: el proveedor tardó demasiado en terminar el job.');
      }

      sse.send({
        event: 'status',
        data: {
          phase: 'processing',
          progress: job.progress,
          message:
            job.progress != null
              ? `Generando captions… ${job.progress}%`
              : 'Generando captions…',
        },
      });

      await sleep(POLL_INTERVAL_MS, abort.signal);
      if (abort.signal.aborted) continue; // el while reevalúa y corta arriba

      job = await provider.getCaptionJob(apiKey || '', submitted.id, abort.signal);
    }

    // --- 4. Desenlace ---
    if (job.status === 'failed') {
      return fail(job.error || 'El proveedor reportó un fallo en el job.');
    }
    if (job.status === 'cancelled') {
      sse.send({ event: 'cancelled', data: { jobId } });
      return sse.close();
    }

    // status === 'complete'
    sse.send({
      event: 'status',
      data: { phase: 'finalizing', progress: 100, message: 'Descargando el video subtitulado…' },
    });

    const captionedUrl = await provider.getCaptionedVideoUrl(
      apiKey || '',
      submitted.id,
      abort.signal
    );

    let localUrl: string | null = null;
    try {
      const persisted = await persistCaptionedVideo({ videoUrl: captionedUrl, jobId });
      localUrl = persisted.url;
      routeLog.info(`video subtitulado persistido en ${persisted.staticPath}`);
    } catch (err) {
      routeLog.warn(
        'no se pudo persistir el video — se devuelve la URL del proveedor: ' +
          (err instanceof Error ? err.message : String(err))
      );
      sse.send({
        event: 'warning',
        data: { message: 'No se pudo guardar el video localmente (URL temporal).' },
      });
    }

    routeLog.info(`job terminado OK tras ${Date.now() - startedAt}ms`);
    sse.send({
      event: 'done',
      data: {
        success: true,
        jobId,
        providerJobId: submitted.id,
        video_url: captionedUrl,
        local_url: localUrl,
      },
    });
    sse.close();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      routeLog.warn('job abortado (fetch cancelado)');
      sse.send({ event: 'cancelled', data: { jobId } });
      return sse.close();
    }
    if (err instanceof CaptionsNotImplementedError) {
      return fail(err.message);
    }
    routeLog.error('excepción no controlada en el job de captions', undefined, err);
    fail(err instanceof Error ? err.message : 'Error interno del gateway');
  }
});

export default router;
