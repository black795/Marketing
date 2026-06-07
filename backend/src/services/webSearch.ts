/**
 * Búsqueda web para enriquecer prompts — proveedor: Tavily.
 *
 * El usuario marca una empresa/marca con `*` adelante (ej. `*Nike`, o
 * `*"Coca Cola"` para nombres con espacios). Antes de generar el guion, los
 * prompts del carrusel o las imágenes, buscamos esas marcas en internet y
 * inyectamos un bloque de contexto con datos reales para que el modelo no
 * invente.
 *
 * Diseño:
 *   - `extractWebSearchQueries` saca las marcas marcadas con `*`.
 *   - `stripWebSearchMarkers` limpia el texto que ve el modelo (quita el `*`
 *     y las comillas, deja el nombre).
 *   - `runWebResearch` busca todas las marcas (en paralelo, con cache) y
 *     arma un bloque de contexto en texto.
 *
 * Robustez: si falta la clave o falla la red, NO rompe la generación —
 * devuelve `contextBlock: null` y el caller igual limpia los marcadores.
 *
 * La clave vive SOLO en el backend: env `TAVILY_API_KEY` o
 * backend/.config/web-search.json `{ "tavilyApiKey": "..." }` (gitignored).
 */
import { createLogger } from './logger';
import { readJsonConfig } from './secrets';

const log = createLogger('web-search');

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
/** Marcas máximas a buscar por request (evita explotar el rate limit). */
const MAX_QUERIES = 4;
/** Resultados por búsqueda. */
const MAX_RESULTS = 4;
/** TTL del cache en memoria (10 min). */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Timeout por búsqueda. */
const SEARCH_TIMEOUT_MS = 8000;

/**
 * Detecta `*Marca`, `*Marca.Compuesta`, `*Title Case Brand` (hasta 4 palabras
 * en Title Case) o `*"Nombre Con Espacios"`. El lookbehind evita matchear
 * `**negrita**` de markdown o un `*` en medio de una palabra.
 */
const WEB_SEARCH_RE =
  /(?<![*\w])\*(?:"([^"]+)"|([\p{Lu}\p{N}][\p{L}\p{N}&.\-'’]*(?:\s+[\p{Lu}\p{N}][\p{L}\p{N}&.\-'’]*){0,3})|([\p{L}][\p{L}\p{N}&.\-'’]*))/gu;

function matchName(m: RegExpMatchArray): string {
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

/** Extrae las marcas marcadas con `*` (deduplicadas, máx MAX_QUERIES). */
export function extractWebSearchQueries(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(WEB_SEARCH_RE)) {
      const name = matchName(m);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= MAX_QUERIES) return out;
    }
  }
  return out;
}

/** Quita los marcadores `*` (y comillas) dejando el nombre limpio para el modelo. */
export function stripWebSearchMarkers(text: string | undefined): string {
  if (!text) return '';
  return text.replace(WEB_SEARCH_RE, (_full, q, multi, single) => q ?? multi ?? single ?? '');
}

/** True si el texto contiene al menos un marcador `*marca`. */
export function hasWebSearchMarkers(...texts: Array<string | undefined>): boolean {
  return extractWebSearchQueries(...texts).length > 0;
}

function getTavilyKey(): string {
  const fromEnv = (process.env.TAVILY_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const cfg = readJsonConfig<{ tavilyApiKey?: string }>('web-search', {});
  return (cfg.tavilyApiKey || '').trim();
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}
interface SearchHit {
  query: string;
  answer: string;
  results: TavilyResult[];
}

// --- Cache en memoria (compartido entre prompts e imágenes del mismo request) ---
const cache = new Map<string, { at: number; hit: SearchHit }>();

function getCached(query: string): SearchHit | null {
  const entry = cache.get(query.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(query.toLowerCase());
    return null;
  }
  return entry.hit;
}

async function searchTavily(query: string, apiKey: string): Promise<SearchHit | null> {
  const cached = getCached(query);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: MAX_RESULTS,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      log.warn(`Tavily respondió ${res.status} para "${query}"`);
      return null;
    }
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const hit: SearchHit = {
      query,
      answer: (data.answer || '').trim(),
      results: (data.results || []).slice(0, MAX_RESULTS).map((r) => ({
        title: (r.title || '').trim(),
        url: (r.url || '').trim(),
        content: (r.content || '').trim(),
      })),
    };
    cache.set(query.toLowerCase(), { at: Date.now(), hit });
    return hit;
  } catch (err) {
    log.warn(`búsqueda web falló para "${query}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

export interface WebResearchResult {
  /** Bloque de contexto listo para inyectar en el prompt (null si no hubo nada). */
  contextBlock: string | null;
  /** Marcas que se buscaron (para logging). */
  queries: string[];
}

/**
 * Busca todas las marcas `*` encontradas en `texts` y arma un bloque de
 * contexto. `compact` produce una versión corta apta para prompts de imagen.
 */
export async function runWebResearch(
  texts: Array<string | undefined>,
  opts: { compact?: boolean; label?: string } = {},
): Promise<WebResearchResult> {
  const queries = extractWebSearchQueries(...texts);
  if (queries.length === 0) return { contextBlock: null, queries: [] };

  const apiKey = getTavilyKey();
  if (!apiKey) {
    log.warn(
      `se mencionaron marcas con * (${queries.join(', ')}) pero falta TAVILY_API_KEY — se omite la búsqueda web`,
    );
    return { contextBlock: null, queries };
  }

  const hits = (await Promise.all(queries.map((q) => searchTavily(q, apiKey)))).filter(
    (h): h is SearchHit => h != null && (!!h.answer || h.results.length > 0),
  );
  if (hits.length === 0) return { contextBlock: null, queries };

  if (opts.compact) {
    // Versión corta para prompts de imagen: solo datos visuales/de marca.
    const lines = hits.map((h) => {
      const facts = h.answer || h.results.map((r) => r.content).join(' ');
      return `- ${h.query}: ${truncate(facts, 280)}`;
    });
    return {
      contextBlock: `Brand reference (datos reales de la web, usalos para el look/branding):\n${lines.join('\n')}`,
      queries,
    };
  }

  const blocks = hits.map((h) => {
    const parts = [`### ${h.query}`];
    if (h.answer) parts.push(truncate(h.answer, 700));
    const sources = h.results
      .filter((r) => r.url)
      .slice(0, 3)
      .map((r) => `- ${r.title || r.url}${r.content ? `: ${truncate(r.content, 200)}` : ''}`);
    if (sources.length > 0) parts.push(`Fuentes:\n${sources.join('\n')}`);
    return parts.join('\n');
  });

  log.info(`investigación web (${opts.label || 'general'}): ${queries.join(', ')}`);
  return {
    contextBlock:
      'Investigación web (datos reales de las marcas/empresas que el usuario marcó con *; ' +
      'usalos para que el contenido sea preciso, NO inventes datos):\n\n' +
      blocks.join('\n\n'),
    queries,
  };
}
