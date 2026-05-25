import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import { getSandboxState, setSandboxEnabled } from '../services/sandbox';

/**
 * Rutas del sandbox / mock mode.
 *
 *   GET  /api/sandbox/status      → { enabled, updatedAt, source }
 *   PUT  /api/sandbox/status      { enabled: boolean } → estado nuevo
 *
 * Si SANDBOX_MODE está forzado por entorno, el PUT no tiene efecto y la
 * fuente devuelve "env". El frontend usa esto para deshabilitar el toggle.
 */

const router = Router();
const log = createLogger('sandbox-api');

router.get('/sandbox/status', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, ...getSandboxState() });
});

router.put('/sandbox/status', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = req.body as { enabled?: unknown };
  if (typeof body?.enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'Body debe ser { enabled: boolean }',
      requestId,
    });
  }
  const next = await setSandboxEnabled(body.enabled);
  log.info(`PUT sandbox.enabled=${body.enabled} → ${next.enabled} (source=${next.source})`, {
    requestId,
  });
  res.status(200).json({ success: true, ...next });
});

export default router;
