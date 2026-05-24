import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  loadEditingProject,
  saveEditingProject,
  type EditingProjectDoc,
} from '../services/editing-project';

/**
 * Endpoints del scene graph (editing-project.json).
 *
 *   GET /api/editing-project/:projectId  — devuelve el doc o 404 si no existe.
 *   PUT /api/editing-project/:projectId  — guarda el doc completo (merge superficial).
 *
 * El backend trata el documento como opaco — el shape vivo está en
 * frontend/editing/types/project.ts. Esto desacopla la evolución del
 * modelo del editor del ciclo de despliegue del backend.
 */
const router = Router();
const log = createLogger('editing-project-api');

router.get('/editing-project/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const doc = loadEditingProject(projectId);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: `No hay editing-project para "${projectId}".`,
    });
  }
  res.status(200).json({ success: true, project: doc });
});

router.put('/editing-project/:projectId', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { projectId } = req.params;
  const body = (req.body || {}) as Partial<EditingProjectDoc>;

  const current = loadEditingProject(projectId) ?? {
    version: 1 as const,
    projectId,
  };
  const next: EditingProjectDoc = {
    ...current,
    ...body,
    version: 1,
    projectId, // el del path manda
  };

  try {
    const saved = saveEditingProject(next);
    res.status(200).json({ success: true, project: saved });
  } catch (err) {
    log.error('no se pudo guardar editing-project', { requestId, projectId }, err);
    res
      .status(500)
      .json({ success: false, error: 'No se pudo guardar editing-project' });
  }
});

export default router;
