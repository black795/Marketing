/**
 * Prompt-to-style mapping — interpreta lenguaje natural y devuelve el mejor
 * `StylePack` por scoring.
 *
 * Algoritmo:
 *   1. Normaliza el prompt (lower, sin tildes).
 *   2. Para cada pack, suma 1 punto por cada `tag` que aparece como palabra.
 *   3. +2 si el id literal aparece (ej. "tiktok-viral").
 *   4. +3 si la frase coincide con un alias predefinido ("más viral" → tiktok-viral).
 *   5. Devuelve el pack ganador + el score; empate → primero del catálogo.
 *
 * Sin LLM. Cuando entre un clasificador IA, sustituye sólo esta función;
 * la UI y el processor no cambian.
 */
import { STYLE_PACKS } from '../presets';
import type { StylePack } from '../configs/style-pack';

interface Alias {
  patterns: RegExp[];
  packId: string;
  weight: number;
}

const ALIASES: Alias[] = [
  { patterns: [/m[aá]s\s+viral/i, /viral\s+boost/i, /tiktok\s+boost/i], packId: 'tiktok-viral', weight: 3 },
  { patterns: [/m[aá]s\s+(dinero|cash|money)/i, /tipo\s+hormozi/i], packId: 'hormozi', weight: 3 },
  { patterns: [/mr\.?\s*beast/i, /m[aá]s\s+energ[ií]a/i], packId: 'mrbeast', weight: 3 },
  { patterns: [/talking\s*head/i, /podcast\s+style/i], packId: 'podcast', weight: 3 },
  { patterns: [/documental/i, /editorial/i, /cinem[aá]tic/i], packId: 'documentary', weight: 2 },
  { patterns: [/gam(er|ing)/i, /twitch/i, /esports?/i, /glitch/i], packId: 'gaming', weight: 3 },
  { patterns: [/m[aá]s\s+elegante/i, /lujo/i, /luxury/i, /fashion/i], packId: 'luxury', weight: 3 },
  { patterns: [/anime/i, /manga/i, /kanji/i, /est[ie]tica\s+anime/i], packId: 'anime', weight: 3 },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export interface PromptMatch {
  pack: StylePack;
  score: number;
  reasons: string[];
}

export function matchStyleFromPrompt(prompt: string): PromptMatch | null {
  const text = prompt.trim();
  if (!text) return null;
  const normalized = normalize(text);
  const words = new Set(normalized.split(/\s+/).filter(Boolean));

  const scores = new Map<string, { score: number; reasons: string[] }>();

  // 1) Tags
  for (const pack of STYLE_PACKS) {
    let s = 0;
    const reasons: string[] = [];
    for (const tag of pack.tags) {
      if (words.has(normalize(tag))) {
        s += 1;
        reasons.push(`tag "${tag}"`);
      }
    }
    if (normalized.includes(pack.id)) {
      s += 2;
      reasons.push(`id "${pack.id}"`);
    }
    if (s > 0) scores.set(pack.id, { score: s, reasons });
  }

  // 2) Aliases — peso mayor
  for (const alias of ALIASES) {
    if (alias.patterns.some((re) => re.test(text))) {
      const prev = scores.get(alias.packId) ?? { score: 0, reasons: [] };
      scores.set(alias.packId, {
        score: prev.score + alias.weight,
        reasons: [...prev.reasons, `alias`],
      });
    }
  }

  if (scores.size === 0) return null;

  // 3) Pick winner
  let best: { id: string; score: number; reasons: string[] } | null = null;
  for (const [id, entry] of scores) {
    if (!best || entry.score > best.score) {
      best = { id, score: entry.score, reasons: entry.reasons };
    }
  }
  if (!best) return null;

  const pack = STYLE_PACKS.find((p) => p.id === best!.id);
  if (!pack) return null;
  return { pack, score: best.score, reasons: best.reasons };
}
