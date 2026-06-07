import Replicate from 'replicate';
import { CAROUSEL_PROMPT_MASTER } from '../../prompts/carouselPromptMaster';
import { runWebResearch, stripWebSearchMarkers } from '../webSearch';
import type {
  CarouselComparisonSide,
  CarouselConfig,
  CarouselPromptScope,
  CarouselReferenceSummary,
  CarouselSlide,
  CarouselSlideRole,
  GenerateCarouselPromptsResponse,
} from '../../types/carousel';

const REPLICATE_MODEL = 'anthropic/claude-4-sonnet';

let cachedClient: Replicate | null = null;

function getClient(): Replicate {
  if (cachedClient) return cachedClient;
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) throw new Error('REPLICATE_API_TOKEN is not set in environment');
  cachedClient = new Replicate({ auth });
  return cachedClient;
}

const TYPE_LABEL: Record<string, string> = {
  educativo: 'educativo',
  venta: 'venta',
  branding: 'branding',
  storytelling: 'storytelling',
  comparativo: 'comparativo',
  'antes-despues': 'antes y después',
  'caso-exito': 'caso de éxito',
};

function describeReferences(refs?: CarouselReferenceSummary): string | null {
  if (!refs) return null;
  // Enumeramos las referencias en el MISMO orden que el front (producto
  // principal → resto productos → secundarias) para que el token @imageN@
  // coincida con la imagen real.
  const items: string[] = [];
  let n = 1;
  for (let i = 0; i < refs.productCount; i++) {
    const isMain = i === 0 && refs.hasPrincipal;
    items.push(`  @image${n}@ = ${isMain ? 'producto principal' : 'producto'}`);
    n++;
  }
  for (const [kind, count] of Object.entries(refs.secondaryByKind)) {
    for (let i = 0; i < (count ?? 0); i++) {
      items.push(`  @image${n}@ = ${kind}`);
      n++;
    }
  }
  if (items.length === 0) return null;
  return [
    `Hay ${items.length} imagen(es) de referencia disponibles para gpt-image-2, numeradas:`,
    items.join('\n'),
    `En "imagePrompt" podés VINCULAR una imagen puntual a un slide escribiendo su token @imageN@ (ej. "place @image1@ as the product in the right card"). El sistema reemplaza el token y manda SOLO esa(s) imagen(es) a ese slide. Usá el token que corresponda a cada slide; si un slide no necesita ninguna referencia, no pongas token.`,
    `Nota: si en el brief o el estilo el usuario menciona una referencia como "@imagenN" (ej. "@imagen1 como producto principal"), corresponde a la imagen #N de la lista de arriba. Honrá esa intención: cuando un slide use esa referencia, poné su token @imageN@ en el "imagePrompt" de ESE slide.`,
  ].join('\n');
}

function buildUserPrompt(
  config: CarouselConfig,
  scope: CarouselPromptScope,
  refs?: CarouselReferenceSummary,
  projectContext?: string,
  siblingSlides?: CarouselSlide[],
  styleContext?: string,
  webContext?: string | null,
): string {
  const parts: string[] = [];

  // El estilo a imitar va primero: encuadra todo lo demás.
  if (styleContext && styleContext.trim()) {
    parts.push(styleContext.trim());
  }

  // Investigación web de las marcas marcadas con * (datos reales).
  if (webContext && webContext.trim()) {
    parts.push(webContext.trim());
  }

  if (projectContext && projectContext.trim()) {
    parts.push(`Contexto del proyecto: ${projectContext.trim()}`);
  }

  parts.push(
    [
      `Producto/tema: ${config.productBrief?.trim() || '(no especificado — inferí del contexto)'}`,
      `Tipo de carrusel: ${TYPE_LABEL[config.type] ?? config.type}`,
      `Objetivo: ${config.objective}`,
      `Plataforma: ${config.platform}`,
      config.styleNote?.trim() ? `Estilo visual deseado: ${config.styleNote.trim()}` : '',
      config.handle?.trim()
        ? `Handle a renderizar al pie de cada slide: ${config.handle.trim()}`
        : 'Sin handle: no agregues @usuario al pie.',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const refLine = describeReferences(refs);
  if (refLine) parts.push(refLine);

  if (scope.kind === 'carousel') {
    parts.push(
      `Generá UN carrusel completo con EXACTAMENTE ${config.slidesPerCarousel} slides (index 1..${config.slidesPerCarousel}). La slide 1 es el hook y la última el CTA. Devolvé el JSON con "title" y "slides".`,
    );
  } else {
    const n = scope.slideIndex;
    parts.push(
      `Regenerá SOLO la slide número ${n} de un carrusel de ${config.slidesPerCarousel} slides. Mantené coherencia con el resto. Devolvé el JSON con "slide" (index ${n}).`,
    );
    if (siblingSlides && siblingSlides.length > 0) {
      const ctx = siblingSlides
        .map((s) => `  Slide ${s.index} (${s.role}): ${s.headline || s.suggestedText}`)
        .join('\n');
      parts.push(`Slides existentes del carrusel (para coherencia):\n${ctx}`);
    }
  }

  return parts.join('\n\n');
}

function extractJson(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/i, '');
  cleaned = cleaned.trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

function joinOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(String).join('');
  if (output == null) return '';
  return String(output);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeComparisonSide(raw: unknown): CarouselComparisonSide | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const label = str(s.label);
  const caption = str(s.caption);
  if (!label && !caption) return null;
  const side: CarouselComparisonSide = { label, caption, emoji: str(s.emoji) };
  const overlay = str(s.overlayText);
  if (overlay) side.overlayText = overlay;
  return side;
}

/** Normaliza una slide cruda de Claude a CarouselSlide (campos seguros). */
function normalizeSlide(raw: unknown, fallbackIndex: number): CarouselSlide {
  const s = (raw ?? {}) as Record<string, unknown>;
  const keyElements = Array.isArray(s.keyElements)
    ? (s.keyElements as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];

  const role: CarouselSlideRole =
    s.role === 'cover' || s.role === 'cta' ? s.role : 'content';

  let comparison: CarouselSlide['comparison'];
  if (s.comparison && typeof s.comparison === 'object') {
    const cmp = s.comparison as Record<string, unknown>;
    const bad = normalizeComparisonSide(cmp.bad);
    const good = normalizeComparisonSide(cmp.good);
    if (bad && good) comparison = { bad, good };
  }

  const headline = str(s.headline);
  const suggestedText = str(s.suggestedText) || headline;

  const slide: CarouselSlide = {
    index: typeof s.index === 'number' && s.index > 0 ? Math.round(s.index) : fallbackIndex,
    role,
    headline: headline || suggestedText,
    visualGoal: str(s.visualGoal),
    composition: str(s.composition),
    suggestedText,
    imagePrompt: str(s.imagePrompt),
    keyElements,
    imageUrl: null,
  };

  const highlightWord = str(s.highlightWord);
  if (highlightWord) slide.highlightWord = highlightWord;
  const subheadline = str(s.subheadline);
  if (subheadline) slide.subheadline = subheadline;
  const body = str(s.body);
  if (body) slide.body = body;
  const cta = str(s.cta);
  if (cta) slide.cta = cta;
  if (comparison) slide.comparison = comparison;

  return slide;
}

/**
 * Genera prompts de carrusel vía Claude. Según el scope devuelve un carrusel
 * completo o una sola slide. NO genera imágenes.
 */
export async function generateCarouselPrompts(input: {
  config: CarouselConfig;
  scope: CarouselPromptScope;
  references?: CarouselReferenceSummary;
  projectContext?: string;
  siblingSlides?: CarouselSlide[];
  styleContext?: string;
}): Promise<GenerateCarouselPromptsResponse> {
  const client = getClient();

  // Busca en internet las marcas marcadas con * (brief, estilo, contexto) y
  // limpia los marcadores antes de mandar el texto a Claude.
  const research = await runWebResearch(
    [input.config.productBrief, input.config.styleNote, input.projectContext],
    { label: 'carrusel' },
  );
  const cleanConfig = {
    ...input.config,
    productBrief: stripWebSearchMarkers(input.config.productBrief),
    styleNote: stripWebSearchMarkers(input.config.styleNote),
  };
  const cleanProjectContext = stripWebSearchMarkers(input.projectContext);

  const output = await client.run(REPLICATE_MODEL, {
    input: {
      prompt: buildUserPrompt(
        cleanConfig,
        input.scope,
        input.references,
        cleanProjectContext,
        input.siblingSlides,
        input.styleContext,
        research.contextBlock,
      ),
      system_prompt: CAROUSEL_PROMPT_MASTER,
      max_tokens: 4096,
      extended_thinking: false,
    },
  });

  const rawText = joinOutput(output);
  if (!rawText) throw new Error('Claude devolvió salida vacía');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(rawText)) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    throw new Error(`Claude devolvió JSON inválido (${reason}). Preview: ${rawText.slice(0, 200)}`);
  }

  if (input.scope.kind === 'slide') {
    const slide = normalizeSlide(parsed.slide ?? parsed, input.scope.slideIndex);
    slide.index = input.scope.slideIndex;
    return { success: true, slide };
  }

  const rawSlides = Array.isArray(parsed.slides) ? (parsed.slides as unknown[]) : [];
  const slides = rawSlides.map((s, i) => normalizeSlide(s, i + 1));
  // Reindexar 1..N por las dudas.
  slides.forEach((s, i) => (s.index = i + 1));
  // Estructura editorial: el primero es la portada, el último el cierre/CTA.
  if (slides.length > 0) {
    slides[0].role = 'cover';
    slides[slides.length - 1].role = 'cta';
  }
  return {
    success: true,
    carousel: {
      title: typeof parsed.title === 'string' ? parsed.title : 'Carrusel',
      slides,
    },
  };
}
