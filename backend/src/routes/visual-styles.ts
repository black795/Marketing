import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  loadStyles,
  getStyle,
  createStyle,
  updateStyle,
  deleteStyle,
  recordUse,
  type StyleRefKind,
} from '../services/visual-styles';

/**
 * API de la Biblioteca de Estilos Visuales.
 *
 *   GET    /api/visual-styles        — todos
 *   GET    /api/visual-styles/:id    — uno
 *   POST   /api/visual-styles        — crear (desde un carrusel terminado)
 *   DELETE /api/visual-styles/:id    — borrar
 *   POST   /api/visual-styles/:id/used — telemetría de uso
 */
const router = Router();
const log = createLogger('visual-styles-api');

router.get('/visual-styles', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, registry: loadStyles() });
});

router.get('/visual-styles/:id', (req: Request, res: Response) => {
  const s = getStyle(req.params.id);
  if (!s) return res.status(404).json({ success: false, error: 'Estilo no encontrado.' });
  res.status(200).json({ success: true, style: s });
});

router.post('/visual-styles', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return res.status(400).json({ success: false, error: 'El estilo necesita un nombre.' });

  try {
    const references = Array.isArray(body.references)
      ? (body.references as Array<{ tipo?: string; url?: string; nombre?: string }>)
          .filter((r) => typeof r?.url === 'string' && r.url.length > 0)
          .map((r) => ({
            tipo: (r.tipo as StyleRefKind) || 'ejemplo',
            url: r.url as string,
            nombre: typeof r.nombre === 'string' ? r.nombre : undefined,
          }))
      : [];

    const style = await createStyle({
      name,
      styleNote: typeof body.styleNote === 'string' ? body.styleNote : '',
      samplePrompts: Array.isArray(body.samplePrompts)
        ? (body.samplePrompts as unknown[]).map((x) => String(x))
        : [],
      references,
      thumbnail: typeof body.thumbnail === 'string' ? body.thumbnail : null,
      source: typeof body.source === 'object' && body.source ? (body.source as any) : undefined,
    });
    res.status(200).json({ success: true, style });
  } catch (err) {
    log.error('no se pudo guardar estilo', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo guardar el estilo: ${msg}` });
  }
});

router.patch('/visual-styles/:id', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const addReferences = Array.isArray(body.addReferences)
      ? (body.addReferences as Array<{ tipo?: string; url?: string; nombre?: string }>)
          .filter((r) => typeof r?.url === 'string' && r.url.length > 0)
          .map((r) => ({
            tipo: (r.tipo as StyleRefKind) || 'ejemplo',
            url: r.url as string,
            nombre: typeof r.nombre === 'string' ? r.nombre : undefined,
          }))
      : [];
    const style = await updateStyle(req.params.id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      styleNote: typeof body.styleNote === 'string' ? body.styleNote : undefined,
      addReferences,
      addSamplePrompts: Array.isArray(body.addSamplePrompts)
        ? (body.addSamplePrompts as unknown[]).map((x) => String(x))
        : [],
    });
    if (!style) return res.status(404).json({ success: false, error: 'Estilo no encontrado.' });
    res.status(200).json({ success: true, style });
  } catch (err) {
    log.error('no se pudo actualizar estilo', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo actualizar: ${msg}` });
  }
});

router.delete('/visual-styles/:id', (req: Request, res: Response) => {
  const ok = deleteStyle(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'Estilo no encontrado.' });
  res.status(200).json({ success: true });
});

router.post('/visual-styles/:id/used', (req: Request, res: Response) => {
  const style = recordUse(req.params.id);
  if (!style) return res.status(404).json({ success: false, error: 'Estilo no encontrado.' });
  res.status(200).json({ success: true, style });
});

export default router;
