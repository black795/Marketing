import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import { validateCarouselConfig } from '../types/carousel';

/**
 * API del Carousel Generator.
 *
 *   POST /api/generate-carousel
 *     Valida la config y, POR AHORA, responde 501 Not Implemented. La
 *     generación real (copy + imágenes por slide) se implementa en el
 *     siguiente paso. La validación ya queda lista para no re-trabajarla.
 *
 * Cuando se implemente la generación, este handler pasará a encolar el job y
 * a streamear los carruseles (mismo patrón SSE que generate-images / videos).
 */
const router = Router();
const log = createLogger('carousel-api');

router.post('/generate-carousel', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Record<string, unknown>;

  const result = validateCarouselConfig(body.config);
  if (!result.ok) {
    return res.status(400).json({ success: false, error: result.error });
  }

  log.info('config de carrusel válida — generación todavía no implementada', {
    requestId,
    config: result.config,
  });

  // 501: el contrato existe y la config es válida, pero la generación aún no
  // está implementada. El frontend muestra el botón como "próximo paso".
  res.status(501).json({
    success: false,
    error: 'La generación de carruseles aún no está implementada.',
    config: result.config,
  });
});

export default router;
