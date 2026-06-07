import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  loadRegistry,
  saveProject,
  getProjectState,
  deleteProject,
} from '../services/project-library';

/**
 * API de la Biblioteca de Proyectos (koda-os Scripts flow).
 *
 *   GET    /api/projects        — metadata de todos
 *   GET    /api/projects/:id    — estado completo (para retomar)
 *   POST   /api/projects        — guardar/sobrescribir ({id?, name, state})
 *   DELETE /api/projects/:id    — borrar
 */
const router = Router();
const log = createLogger('project-library-api');

router.get('/projects', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, registry: loadRegistry() });
});

router.get('/projects/:id', (req: Request, res: Response) => {
  const state = getProjectState(req.params.id);
  if (state === null) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' });
  res.status(200).json({ success: true, state });
});

router.post('/projects', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as { id?: string; name?: string; state?: unknown };
  const name = typeof body.name === 'string' ? body.name : '';
  if (body.state == null || typeof body.state !== 'object') {
    return res.status(400).json({ success: false, error: 'Falta el estado del proyecto.' });
  }
  try {
    const meta = saveProject({ id: body.id, name, state: body.state });
    res.status(200).json({ success: true, project: meta });
  } catch (err) {
    log.error('no se pudo guardar el proyecto', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo guardar: ${msg}` });
  }
});

router.delete('/projects/:id', (req: Request, res: Response) => {
  const ok = deleteProject(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' });
  res.status(200).json({ success: true });
});

export default router;
