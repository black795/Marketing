import { Router, Request, Response } from 'express';
import { generateAvatar } from '../services/python-worker/avatarWorker';
import { persistAvatarVideo } from '../services/video-persistence';
import { openSseStream } from '../services/sse';
import { createLogger, newId } from '../services/logger';
import { metrics } from '../services/metrics';

/**
 * Ruta del modo Avatar: genera un video de avatar/lipsync con
 * prunaai/p-video-avatar. Es un job único (un video), a diferencia de las
 * rutas de imágenes/videos que iteran escenas.
 *
 * En modo SSE emite eventos de estado en vivo (queued → processing →
 * rendering → done) para que el frontend muestre progreso real. La
 * cancelación usa el mismo mecanismo corregido de services/sse.ts:
 * solo aborta ante una desconexión REAL del cliente.
 */

const RESOLUTIONS = new Set(['720p', '1080p']);

interface AvatarRequestBody {
  image?: string;
  resolution?: string;
  audio?: string | null;
  voiceScript?: string;
  voice?: string;
  voicePrompt?: string;
  voiceLanguage?: string;
  videoPrompt?: string;
  seed?: number | null;
  disableSafetyFilter?: boolean;
  disablePromptUpsampling?: boolean;
}

const router = Router();
const log = createLogger('generate-avatar');

/** Heartbeat de estado mientras el worker renderiza (el render es bloqueante). */
const HEARTBEAT_MS = 3_000;
/** Tras este tiempo consideramos que está renderizando (no solo procesando). */
const RENDERING_AFTER_MS = 20_000;

router.post('/generate-avatar', async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string) || newId('req');
  const jobId = newId('avatar');
  const routeLog = log.child({ requestId, jobId });

  const body = req.body as AvatarRequestBody;
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const audio =
    typeof body.audio === 'string' && body.audio.trim().length > 0
      ? body.audio.trim()
      : undefined;
  const voiceScript = typeof body.voiceScript === 'string' ? body.voiceScript : '';
  const resolution = RESOLUTIONS.has(body.resolution || '')
    ? (body.resolution as string)
    : '720p';

  // ---------------- Validación de payload ----------------
  if (!image) {
    routeLog.warn('payload inválido: falta "image"');
    return res.status(400).json({
      success: false,
      error: 'Se requiere una imagen de avatar ("image")',
      requestId,
    });
  }
  if (!audio && voiceScript.trim().length === 0) {
    routeLog.warn('payload inválido: sin voiceScript ni audio');
    return res.status(400).json({
      success: false,
      error: 'Se requiere un guion de voz ("voiceScript") o un audio ("audio")',
      requestId,
    });
  }

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream'));

  const mode = audio ? 'audio' : 'tts';
  routeLog.info(
    `inicio resolution=${resolution} mode=${mode} scriptLen=${voiceScript.length} ` +
      `stream=${wantsStream}`
  );

  const avatarInput = {
    image,
    resolution,
    audio,
    voiceScript,
    voice: body.voice,
    voicePrompt: body.voicePrompt,
    voiceLanguage: body.voiceLanguage,
    videoPrompt: body.videoPrompt,
    seed: typeof body.seed === 'number' ? body.seed : null,
    disableSafetyFilter: body.disableSafetyFilter,
    disablePromptUpsampling: body.disablePromptUpsampling,
    logContext: { requestId, jobId },
  };

  // ====================================================================
  // Modo SSE — estado en vivo + cancelación.
  // ====================================================================
  if (wantsStream) {
    const startedAt = Date.now();
    const abort = new AbortController();

    const sse = openSseStream(res, {
      label: 'generate-avatar',
      context: { requestId, jobId },
      onClientDisconnect: () => {
        metrics.cancellations += 1;
        routeLog.warn('cancelación REAL: el cliente cerró la conexión — abortando');
        abort.abort();
      },
    });

    sse.send({
      event: 'start',
      data: { jobId, requestId, model: 'p-video-avatar', resolution, mode },
    });

    // Heartbeat de estado: el render del worker es bloqueante, así que el
    // progreso fino no existe — pero sí informamos fase + tiempo transcurrido.
    const heartbeat = setInterval(() => {
      if (abort.signal.aborted || sse.isClientGone()) return;
      const elapsedMs = Date.now() - startedAt;
      const phase = elapsedMs < RENDERING_AFTER_MS ? 'processing' : 'rendering';
      sse.send({
        event: 'status',
        data: {
          phase,
          elapsedMs,
          message:
            phase === 'processing'
              ? 'El worker está preparando la generación…'
              : 'Renderizando el video del avatar…',
        },
      });
    }, HEARTBEAT_MS);

    try {
      const result = await generateAvatar({ ...avatarInput, abortSignal: abort.signal });
      clearInterval(heartbeat);

      const cancelled = sse.isClientGone() || abort.signal.aborted;
      if (cancelled) {
        routeLog.warn(`job cancelado tras ${Date.now() - startedAt}ms`);
        sse.send({ event: 'cancelled', data: { jobId } });
        sse.close();
        return;
      }

      if (!result.video_url) {
        routeLog.error(`job falló: ${result.video_error}`);
        sse.send({
          event: 'error',
          data: { jobId, error: result.video_error || 'Generación fallida' },
        });
        sse.close();
        return;
      }

      // Persistimos el MP4 localmente: la URL de Replicate expira.
      let localUrl: string | null = null;
      try {
        const persisted = await persistAvatarVideo({
          videoUrl: result.video_url,
          jobId,
        });
        localUrl = persisted.url;
        routeLog.info(`video persistido en ${persisted.staticPath}`);
      } catch (err) {
        routeLog.warn(
          'no se pudo persistir el video — se devuelve la URL temporal de Replicate: ' +
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
          video_url: result.video_url,
          local_url: localUrl,
        },
      });
      sse.close();
      return;
    } catch (err) {
      clearInterval(heartbeat);
      routeLog.error('excepción no controlada en el job de avatar', undefined, err);
      sse.send({
        event: 'error',
        data: {
          jobId,
          error: err instanceof Error ? err.message : 'Error interno del gateway',
        },
      });
      sse.close();
      return;
    }
  }

  // ====================================================================
  // Modo JSON (sin streaming) — útil para integraciones / pruebas.
  // ====================================================================
  const result = await generateAvatar(avatarInput);
  if (!result.video_url) {
    routeLog.error(`job JSON falló: ${result.video_error}`);
    return res.status(502).json({
      success: false,
      error: result.video_error || 'Generación fallida',
      requestId,
      jobId,
    });
  }

  let localUrl: string | null = null;
  try {
    const persisted = await persistAvatarVideo({ videoUrl: result.video_url, jobId });
    localUrl = persisted.url;
  } catch (err) {
    routeLog.warn(
      'persist falló (modo JSON): ' +
        (err instanceof Error ? err.message : String(err))
    );
  }

  routeLog.info('job JSON terminado OK');
  return res.status(200).json({
    success: true,
    requestId,
    jobId,
    video_url: result.video_url,
    local_url: localUrl,
  });
});

export default router;
