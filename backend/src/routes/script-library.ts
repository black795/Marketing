import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  loadScripts,
  getScript,
  createScript,
  deleteScript,
  recordUse,
} from '../services/script-library';

/**
 * API de la Biblioteca de Guiones Favoritos.
 *
 *   GET    /api/script-library        — todos
 *   GET    /api/script-library/:id    — uno
 *   POST   /api/script-library        — guardar un guion aprobado
 *   DELETE /api/script-library/:id    — borrar
 *   POST   /api/script-library/:id/used — telemetría de uso (few-shot)
 */
const router = Router();
const log = createLogger('script-library-api');

router.get('/script-library', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, registry: loadScripts() });
});

router.get('/script-library/:id', (req: Request, res: Response) => {
  const s = getScript(req.params.id);
  if (!s) return res.status(404).json({ success: false, error: 'Guion no encontrado.' });
  res.status(200).json({ success: true, script: s });
});

router.post('/script-library', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Record<string, unknown>;
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (!summary) {
    return res.status(400).json({ success: false, error: 'El guion necesita un resumen para guardarse.' });
  }
  try {
    const script = await createScript({
      name: typeof body.name === 'string' ? body.name : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      style: typeof body.style === 'string' ? body.style : undefined,
      summary,
      sourcePrompt: typeof body.sourcePrompt === 'string' ? body.sourcePrompt : undefined,
      sceneCount: typeof body.sceneCount === 'number' ? body.sceneCount : undefined,
      images: Array.isArray(body.images)
        ? (body.images as unknown[]).filter((s): s is string => typeof s === 'string')
        : undefined,
    });
    res.status(200).json({ success: true, script });
  } catch (err) {
    log.error('no se pudo guardar guion favorito', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo guardar el guion: ${msg}` });
  }
});

router.delete('/script-library/:id', (req: Request, res: Response) => {
  const ok = deleteScript(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'Guion no encontrado.' });
  res.status(200).json({ success: true });
});

router.post('/script-library/:id/used', (req: Request, res: Response) => {
  const script = recordUse(req.params.id);
  if (!script) return res.status(404).json({ success: false, error: 'Guion no encontrado.' });
  res.status(200).json({ success: true, script });
});

export default router;
