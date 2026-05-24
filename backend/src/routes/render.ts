import { Router, Request, Response } from 'express';
import { openSseStream } from '../services/sse';
import { createLogger, newId } from '../services/logger';
import { loadLastRender, renderProject } from '../services/render';
import { EXPORT_PRESETS } from '../services/render-presets';

/**
 * Render del video editado.
 *
 *   GET  /api/render/presets             — lista los export presets disponibles.
 *   GET  /api/render/:projectId          — metadata del último render (404 si nunca).
 *   POST /api/render/:projectId  (SSE)   — renderiza con cache incremental.
 *     Body: { burnCaptions?, presetId?, force?, parallelism? }
 *     Eventos: start | progress | done | cancelled | error
 */
const router = Router();
const log = createLogger('render-api');

router.get('/render/presets', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, presets: EXPORT_PRESETS });
});

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
  const body = (req.body || {}) as {
    burnCaptions?: boolean;
    presetId?: string | null;
    force?: boolean;
    parallelism?: number;
  };
  const burnCaptions = body.burnCaptions !== false;
  const presetId = typeof body.presetId === 'string' ? body.presetId : null;
  const force = body.force === true;
  const parallelism =
    typeof body.parallelism === 'number' && body.parallelism > 0
      ? Math.min(body.parallelism, 8)
      : undefined;
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
    data: { projectId, burnCaptions, presetId, force, parallelism, requestId },
  });

  try {
    const result = await renderProject({
      projectId,
      burnCaptions,
      presetId,
      force,
      parallelism,
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
