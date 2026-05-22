import { Router, Request, Response } from 'express';
import { generateImage } from '../services/python-worker/imageWorker';
import { openSseStream } from '../services/sse';
import { createLogger, newId } from '../services/logger';
import { metrics } from '../services/metrics';

interface RegenerateSceneInput {
  scene_number: number;
  image_prompt: string;
}

interface RegenerateRequestBody {
  model?: string;
  scenes?: RegenerateSceneInput[];
  quality?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}

const router = Router();
const log = createLogger('regenerate-images');

router.post('/regenerate-images', async (req: Request, res: Response) => {
  // requestId lo asigna el middleware global (server.ts); jobId identifica
  // este job de regeneración concreto. Juntos dan trazabilidad completa.
  const requestId = (res.locals.requestId as string) || newId('req');
  const jobId = newId('job');
  const routeLog = log.child({ requestId, jobId });

  const { model, scenes, quality, aspectRatio, referenceImages } =
    req.body as RegenerateRequestBody;

  const refs: string[] = Array.isArray(referenceImages)
    ? referenceImages.filter((s) => typeof s === 'string' && s.length > 0)
    : [];

  // ---------------- Validación de payload ----------------
  if (!model || typeof model !== 'string') {
    routeLog.warn('payload inválido: falta o es inválido "model"');
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "model" field',
      requestId,
    });
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    routeLog.warn('payload inválido: "scenes" vacío o ausente');
    return res.status(400).json({
      success: false,
      error: 'Missing or empty "scenes" array',
      requestId,
    });
  }

  const invalid = scenes.find(
    (s) =>
      typeof s.scene_number !== 'number' ||
      typeof s.image_prompt !== 'string' ||
      s.image_prompt.trim().length === 0
  );
  if (invalid) {
    routeLog.warn('payload inválido: alguna escena está mal formada');
    return res.status(400).json({
      success: false,
      error:
        'Each scene must include scene_number (number) and image_prompt (non-empty string)',
      requestId,
    });
  }

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream'));

  routeLog.info(
    `inicio model=${model} count=${scenes.length} ` +
      `scenes=[${scenes.map((s) => s.scene_number).join(',')}] ` +
      `stream=${wantsStream} refs=${refs.length}`
  );

  type ResultEntry = {
    scene_number: number;
    image_url: string | null;
    image_error?: string;
  };

  // ====================================================================
  // Modo SSE — streaming en vivo con cancelación.
  // ====================================================================
  if (wantsStream) {
    const startedAt = Date.now();
    const abort = new AbortController();

    // El AbortController se dispara EXCLUSIVAMENTE desde onClientDisconnect,
    // que openSseStream sólo invoca ante una desconexión REAL del cliente
    // (res.on('close') con !writableEnded). Antes esto colgaba de
    // req.on('close'), que saltaba al terminar de subir el body del POST y
    // mataba la primera imagen con "cancelled by client" sin que el usuario
    // hubiese cancelado nada. Ver el comentario extenso en services/sse.ts.
    const sse = openSseStream(res, {
      label: 'regenerate-images',
      context: { requestId, jobId },
      onClientDisconnect: () => {
        metrics.cancellations += 1;
        routeLog.warn(
          'cancelación REAL: el cliente cerró la conexión — abortando el job'
        );
        abort.abort();
      },
    });

    sse.send({
      event: 'start',
      data: { model, total: scenes.length, requestId, jobId },
    });

    const results: ResultEntry[] = [];
    for (const scene of scenes) {
      // Se corta el bucle sólo ante cancelación real (abort) o desconexión.
      if (abort.signal.aborted || sse.isClientGone()) {
        routeLog.warn(
          `bucle detenido antes de la escena ${scene.scene_number} (job cancelado)`
        );
        break;
      }

      const sceneId = `scene-${scene.scene_number}`;
      const sceneStartedAt = Date.now();
      routeLog.info(`escena ${scene.scene_number} → generando`, { sceneId });

      sse.send({
        event: 'scene-start',
        data: {
          scene_number: scene.scene_number,
          index: results.length,
          total: scenes.length,
        },
      });

      const result = await generateImage({
        model,
        prompt: scene.image_prompt,
        quality,
        aspectRatio,
        referenceImageUrls: refs.length > 0 ? refs : undefined,
        abortSignal: abort.signal,
        logContext: { requestId, jobId, sceneId },
      });

      metrics.imageGenerations += 1;
      if (!result.image_url) metrics.imageGenerationFailures += 1;

      const entry: ResultEntry = {
        scene_number: scene.scene_number,
        image_url: result.image_url,
        ...(result.image_error ? { image_error: result.image_error } : {}),
      };
      results.push(entry);

      routeLog.info(
        `escena ${scene.scene_number} ← ${result.image_url ? 'ok' : 'fallo'} ` +
          `(${Date.now() - sceneStartedAt}ms)`,
        { sceneId, ...(result.image_error ? { error: result.image_error } : {}) }
      );

      sse.send({
        event: 'scene-done',
        data: {
          result: entry,
          index: results.length,
          total: scenes.length,
          progress: results.length / scenes.length,
        },
      });
    }

    const cancelled = sse.isClientGone() || abort.signal.aborted;
    if (cancelled) {
      routeLog.warn(
        `job cancelado — ${results.length}/${scenes.length} completadas ` +
          `(${Date.now() - startedAt}ms)`
      );
      sse.send({
        event: 'cancelled',
        data: { completed: results.length, total: scenes.length, results },
      });
    } else {
      const failed = results.filter((r) => !r.image_url).length;
      routeLog.info(
        `job terminado total=${results.length} failed=${failed} ` +
          `(${Date.now() - startedAt}ms)`
      );
      sse.send({
        event: 'done',
        data: { success: true, model, results, failed },
      });
    }

    sse.close();
    return;
  }

  // ====================================================================
  // Modo JSON legacy (compat) — sin streaming ni cancelación temprana.
  // ====================================================================
  const results: ResultEntry[] = [];
  for (const scene of scenes) {
    const sceneId = `scene-${scene.scene_number}`;
    routeLog.info(`escena ${scene.scene_number} → (modo JSON)`, { sceneId });
    const result = await generateImage({
      model,
      prompt: scene.image_prompt,
      quality,
      aspectRatio,
      referenceImageUrls: refs.length > 0 ? refs : undefined,
      logContext: { requestId, jobId, sceneId },
    });
    metrics.imageGenerations += 1;
    if (!result.image_url) metrics.imageGenerationFailures += 1;
    results.push({
      scene_number: scene.scene_number,
      image_url: result.image_url,
      ...(result.image_error ? { image_error: result.image_error } : {}),
    });
  }

  const failed = results.filter((r) => !r.image_url).length;
  routeLog.info(`job JSON terminado total=${results.length} failed=${failed}`);

  return res.status(200).json({
    success: true,
    model,
    results,
    requestId,
  });
});

export default router;
