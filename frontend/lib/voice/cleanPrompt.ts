// Limpieza y normalización de texto dictado por voz.
//
// El Web Speech API entrega frases sin puntuar, con muletillas y a veces
// con palabras repetidas. Este helper hace passes locales (sin LLM) para
// dejar un prompt útil para modelos generativos.
//
// Reglas:
//  1. Mapea comandos hablados de puntuación ("coma" → ",").
//  2. Limpia fillers ("eh", "este", "o sea", "uhm", etc.).
//  3. Colapsa repeticiones inmediatas ("una una mujer" → "una mujer").
//  4. Normaliza espacios alrededor de puntuación.
//  5. Capitaliza la primera letra de cada oración.
//  6. Inserta un punto al final si quedó pendiente.

const PUNCT_COMMANDS_ES: Array<{ re: RegExp; replace: string }> = [
  { re: /\bnueva\s+linea\b/gi, replace: '\n' },
  { re: /\bnueva\s+línea\b/gi, replace: '\n' },
  { re: /\bsalto\s+de\s+linea\b/gi, replace: '\n' },
  { re: /\bsalto\s+de\s+línea\b/gi, replace: '\n' },
  { re: /\bpunto\s+y\s+aparte\b/gi, replace: '.\n\n' },
  { re: /\bpunto\s+y\s+seguido\b/gi, replace: '. ' },
  { re: /\bpunto\s+final\b/gi, replace: '.' },
  { re: /\bdos\s+puntos\b/gi, replace: ':' },
  { re: /\bpunto\s+y\s+coma\b/gi, replace: ';' },
  { re: /\bsigno\s+de\s+interrogacion\b/gi, replace: '?' },
  { re: /\bsigno\s+de\s+interrogación\b/gi, replace: '?' },
  { re: /\bsigno\s+de\s+exclamacion\b/gi, replace: '!' },
  { re: /\bsigno\s+de\s+exclamación\b/gi, replace: '!' },
  { re: /\bcoma\b/gi, replace: ',' },
  { re: /\bpunto\b/gi, replace: '.' },
];

const PUNCT_COMMANDS_EN: Array<{ re: RegExp; replace: string }> = [
  { re: /\bnew\s+line\b/gi, replace: '\n' },
  { re: /\bnew\s+paragraph\b/gi, replace: '.\n\n' },
  { re: /\bperiod\b/gi, replace: '.' },
  { re: /\bfull\s+stop\b/gi, replace: '.' },
  { re: /\bcomma\b/gi, replace: ',' },
  { re: /\bcolon\b/gi, replace: ':' },
  { re: /\bsemicolon\b/gi, replace: ';' },
  { re: /\bquestion\s+mark\b/gi, replace: '?' },
  { re: /\bexclamation\s+mark\b/gi, replace: '!' },
];

const FILLERS = [
  // ES
  'eh',
  'em',
  'este',
  'osea',
  'o sea',
  'tipo',
  'pues',
  'bueno',
  'como que',
  'a ver',
  'digamos',
  'mira',
  'sabes',
  // EN
  'uh',
  'um',
  'uhm',
  'erm',
  'like',
  'you know',
  'i mean',
];

function buildFillerRegex(): RegExp {
  // word-boundary, case-insensitive. Multi-word patterns soportados.
  const escaped = FILLERS.map((f) =>
    f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  return new RegExp(`(^|[\\s,;:!?])(${escaped.join('|')})(?=[\\s,.;:!?]|$)`, 'gi');
}

const FILLER_RE = buildFillerRegex();

function applyPunctCommands(text: string, lang: 'es' | 'en'): string {
  const rules = lang === 'es' ? PUNCT_COMMANDS_ES : PUNCT_COMMANDS_EN;
  let out = text;
  for (const { re, replace } of rules) {
    out = out.replace(re, replace);
  }
  return out;
}

function stripFillers(text: string): string {
  return text.replace(FILLER_RE, '$1');
}

function collapseRepeats(text: string): string {
  // "una una" o "the the" → "una" / "the". Sólo palabras ≥3 chars para no
  // romper "no no" intencional u onomatopeyas.
  return text.replace(/\b(\w{3,})(\s+\1\b)+/gi, '$1');
}

function normalizeSpaces(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?([,;:.!?]) ?/g, '$1 ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/g, '');
}

function capitalizeSentences(text: string): string {
  // Capitaliza tras . ! ? \n o al inicio.
  return text.replace(/(^|[.!?]\s+|\n+)([a-záéíóúñü])/g, (_m, p1, p2) => {
    return p1 + p2.toUpperCase();
  });
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return trimmed;
  if (/[.!?…]$/.test(trimmed)) return trimmed;
  return trimmed + '.';
}

export interface CleanPromptOptions {
  lang?: 'es' | 'en';
  /** Si true, agrega punto final si falta. */
  ensureTerminal?: boolean;
}

/**
 * Limpia un fragmento de transcripción. Pensado para correr cada vez que
 * llega un resultado final del recognizer, sobre ese fragmento aislado.
 */
export function cleanSpokenChunk(
  raw: string,
  opts: CleanPromptOptions = {}
): string {
  const lang = opts.lang ?? detectLanguage(raw);
  let out = raw;
  out = applyPunctCommands(out, lang);
  out = stripFillers(out);
  out = collapseRepeats(out);
  out = normalizeSpaces(out);
  out = capitalizeSentences(out);
  if (opts.ensureTerminal) out = ensureTerminalPunctuation(out);
  return out.trim();
}

/**
 * Une el texto previo con el nuevo chunk limpio, respetando puntuación.
 * Si el chunk empieza con puntuación (porque era "coma"/"punto"), se pega
 * sin espacio. Si el prev no termina en puntuación y el chunk empieza con
 * letra, agrega espacio.
 */
export function appendCleanedChunk(prev: string, chunk: string): string {
  const cleaned = chunk.trim();
  if (!cleaned) return prev;
  const prevEnd = prev.slice(-1);
  if (!prev) return cleaned;
  if (/[.,;:!?\n]/.test(cleaned[0])) {
    return (prev.trimEnd() + cleaned).replace(/\s+([.,;:!?])/g, '$1');
  }
  const sep = prevEnd && !/\s/.test(prevEnd) ? ' ' : '';
  return prev + sep + cleaned;
}

/**
 * Heurística simple para elegir reglas ES o EN según el contenido del chunk.
 * Mira palabras frecuentes en cada idioma. Si no está claro, usa el idioma
 * del navegador.
 */
function detectLanguage(text: string): 'es' | 'en' {
  const t = ` ${text.toLowerCase()} `;
  const esHits = (t.match(/\b(que|de|la|el|y|con|por|para|un|una|en|coma|punto)\b/g) ?? []).length;
  const enHits = (t.match(/\b(the|and|with|for|of|to|in|a|comma|period)\b/g) ?? []).length;
  if (esHits > enHits) return 'es';
  if (enHits > esHits) return 'en';
  const browser =
    typeof navigator !== 'undefined' ? navigator.language || 'es' : 'es';
  return browser.toLowerCase().startsWith('es') ? 'es' : 'en';
}
