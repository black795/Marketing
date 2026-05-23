import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  defaultEditPlan,
  loadEditPlan,
  saveEditPlan,
  type EditPlan,
} from '../services/edit-plan';

/**
 * Endpoints del Hub de Assets:
 *
 *   GET /api/edit-plan/:projectId  — devuelve el plan guardado o uno default.
 *   PUT /api/edit-plan/:projectId  — guarda el plan (merge con el actual).
 */

const router = Router();
const log = createLogger('edit-plan-api');

router.get('/edit-plan/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const stored = loadEditPlan(projectId);
  const plan = stored ?? defaultEditPlan(projectId);
  res.status(200).json({ success: true, plan, fresh: stored === null });
});

router.put('/edit-plan/:projectId', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { projectId } = req.params;
  const body = (req.body || {}) as Partial<EditPlan>;

  const current = loadEditPlan(projectId) ?? defaultEditPlan(projectId);
  const next: EditPlan = {
    ...current,
    ...body,
    projectId, // el del path manda, evita confundir o falsificar
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = saveEditPlan(next);
    res.status(200).json({ success: true, plan: saved });
  } catch (err) {
    log.error('no se pudo guardar el edit-plan', { requestId, projectId }, err);
    res
      .status(500)
      .json({ success: false, error: 'No se pudo guardar el edit-plan' });
  }
});

export default router;
