import { Router, Request, Response } from 'express';
import { openSseStream } from '../services/sse';
import { createLogger, newId } from '../services/logger';
import { loadLastRender, renderProject } from '../services/render';

/**
 * Render del video editado.
 *
 *   POST /api/render/:projectId  (SSE)
 *     Construye el MP4 final desde el `timeline.json` + `edit-plan.json` y
 *     emite eventos `progress` / `done` / `error`. Acepta body opcional
 *     `{ burnCaptions?: boolean }` (default true).
 *
 *   GET  /api/render/:projectId
 *     Devuelve la metadata del último render (200) o 404 si nunca se hizo.
 */
const router = Router();
const log = createLogger('render-api');

router.get('/render/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const last = loadLastRender(projectId);
  if (!last) {
    return res.status(404).json({
      success: false,
      error: `No hay render previo para "${projectId}".`,
    });
  }
  res.status(200).json({ success: true, render: last });
});

router.post('/render/:projectId', async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string) || newId('req');
  const { projectId } = req.params;
  const body = (req.body || {}) as { burnCaptions?: boolean };
  const burnCaptions = body.burnCaptions !== false; // default true
  const routeLog = log.child({ requestId, projectId });

  const abort = new AbortController();
  const stream = openSseStream(res, {
    label: 'render',
    context: { requestId, projectId },
    onClientDisconnect: () => {
      routeLog.warn('cliente abandonó el stream — abortando render');
      abort.abort();
    },
  });

  stream.send({
    event: 'start',
    data: { projectId, burnCaptions, requestId },
  });

  try {
    const result = await renderProject({
      projectId,
      burnCaptions,
      signal: abort.signal,
      onProgress: (e) => {
        if (stream.isClientGone()) return;
        stream.send({ event: 'progress', data: e });
      },
    });

    if (stream.isClientGone()) {
      routeLog.warn('render terminó pero el cliente ya se fue');
      stream.close();
      return;
    }

    stream.send({ event: 'done', data: { render: result } });
  } catch (err) {
    if (abort.signal.aborted) {
      stream.send({ event: 'cancelled', data: { reason: 'aborted' } });
    } else {
      const message =
        err instanceof Error ? err.message : 'Error desconocido en el render';
      routeLog.error('render falló', { requestId, projectId }, err);
      stream.send({ event: 'error', data: { error: message } });
    }
  } finally {
    stream.close();
  }
});

export default router;
