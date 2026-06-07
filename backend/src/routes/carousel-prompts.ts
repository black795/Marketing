import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import { validateCarouselConfig } from '../types/carousel';
import { generateCarouselPrompts } from '../services/claude/carouselPromptEngine';
import type {
  CarouselPromptScope,
  CarouselReferenceSummary,
  CarouselSlide,
  GenerateCarouselPromptsRequest,
} from '../types/carousel';

/**
 * Motor de PROMPTS de carrusel (texto). NO genera imágenes.
 *
 *   POST /api/generate-carousel-prompts
 *     body: { config, scope, references?, projectContext?, siblingSlides? }
 *     - scope.kind = 'carousel' → devuelve { carousel: { title, slides } }
 *     - scope.kind = 'slide'    → devuelve { slide }
 *
 * El cliente llama una vez por carrusel (genera el set en N llamadas) y
 * reusa este mismo endpoint para regenerar un carrusel o una slide.
 */
const router = Router();
const log = createLogger('carousel-prompts-api');

function parseScope(raw: unknown): CarouselPromptScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.kind === 'carousel' && typeof s.carouselIndex === 'number') {
    return { kind: 'carousel', carouselIndex: s.carouselIndex };
  }
  if (
    s.kind === 'slide' &&
    typeof s.carouselIndex === 'number' &&
    typeof s.slideIndex === 'number'
  ) {
    return { kind: 'slide', carouselIndex: s.carouselIndex, slideIndex: s.slideIndex };
  }
  return null;
}

router.post('/generate-carousel-prompts', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Partial<GenerateCarouselPromptsRequest>;

  const cfg = validateCarouselConfig(body.config);
  if (!cfg.ok) {
    return res.status(400).json({ success: false, error: cfg.error });
  }

  const scope = parseScope(body.scope);
  if (!scope) {
    return res.status(400).json({ success: false, error: 'scope inválido.' });
  }

  try {
    const result = await generateCarouselPrompts({
      config: cfg.config,
      scope,
      references: body.references as CarouselReferenceSummary | undefined,
      projectContext: typeof body.projectContext === 'string' ? body.projectContext : undefined,
      siblingSlides: Array.isArray(body.siblingSlides)
        ? (body.siblingSlides as CarouselSlide[])
        : undefined,
      styleContext: typeof body.styleContext === 'string' ? body.styleContext : undefined,
    });
    log.info('prompts de carrusel generados', { requestId, scope: scope.kind });
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    log.error('falló la generación de prompts de carrusel', { requestId }, err);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
