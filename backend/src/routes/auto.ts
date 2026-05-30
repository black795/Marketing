import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import { loadTimeline } from '../services/timeline';
import { planFromPrompt } from '../services/claude/autoPlanner';

const router = Router();
const log = createLogger('auto-api');

/**
 * IDs de estilos de subtítulos que el LLM puede elegir.
 * Debe coincidir con SUBTITLE_STYLES de services/render.ts.
 */
const AVAILABLE_STYLES = [
  'default',
  'tiktok-yellow',
  'hormozi-green',
  'mrbeast-white',
  'minimal',
  'highlight',
  'karaoke',
];

/**
 * POST /api/auto/plan/:projectId
 * Body: { prompt: string }
 * Devuelve { plan: { sceneOrder, captions, reasoning } }
 *
 * Llama a Claude (vía Replicate) con el prompt + metadata del proyecto y
 * devuelve un plan de edición listo para aplicar. NO persiste nada — el
 * frontend muestra el preview y, si el usuario confirma, llama a los
 * endpoints existentes (edit-plan, captions, render).
 */
router.post('/auto/plan/:projectId', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { projectId } = req.params;
  const body = (req.body || {}) as { prompt?: string };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Falta el campo "prompt"',
      requestId,
    });
  }

  const timeline = loadTimeline(projectId);
  if (!timeline) {
    return res.status(404).json({
      success: false,
      error: `No hay timeline para "${projectId}"`,
      requestId,
    });
  }

  // Escenas disponibles (deduplicadas por sceneNumber).
  const seen = new Set<number>();
  const scenes: Array<{ sceneNumber: number; durationSeconds: number }> = [];
  for (const c of timeline.clips) {
    if (seen.has(c.sceneNumber)) continue;
    seen.add(c.sceneNumber);
    scenes.push({
      sceneNumber: c.sceneNumber,
      durationSeconds: Math.round((c.durationFrames / timeline.fps) * 100) / 100,
    });
  }

  if (scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'El proyecto no tiene clips. Subí algo en /editor/manual primero.',
      requestId,
    });
  }

  try {
    const plan = await planFromPrompt({
      prompt,
      scenes,
      availableStyles: AVAILABLE_STYLES,
    });

    log.info(
      `auto-plan ok projectId=${projectId} scenes=${plan.sceneOrder.length} ` +
        `captions=${plan.captions.length}`,
      { requestId }
    );

    return res.status(200).json({ success: true, plan });
  } catch (err) {
    log.error('auto-plan falló', { requestId, projectId }, err);
    return res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error generando el plan',
      requestId,
    });
  }
});

export default router;
