import { Router, Request, Response } from 'express';
import { enhancePrompt } from '../services/claude/promptEnhancer';
import { createLogger } from '../services/logger';

/**
 * POST /api/enhance-prompt — reescribe un prompt (visual|narrative) con Claude.
 */
const router = Router();
const log = createLogger('enhance-prompt');

router.post('/enhance-prompt', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as { text?: string; kind?: string; aestheticDirective?: string };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ success: false, error: 'Falta el texto a mejorar.' });
  }
  const kind = body.kind === 'narrative' ? 'narrative' : 'visual';

  try {
    const improved = await enhancePrompt({
      text,
      kind,
      aestheticDirective:
        typeof body.aestheticDirective === 'string' ? body.aestheticDirective : undefined,
    });
    return res.status(200).json({ success: true, text: improved });
  } catch (err) {
    log.error('no se pudo mejorar el prompt', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    return res.status(500).json({ success: false, error: `No se pudo mejorar: ${msg}` });
  }
});

export default router;
