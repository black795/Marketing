/**
 * Heurísticas de detección narrativa — alimentan al `classifyScene`.
 *
 * Son patrones, no NLP serio. Cuando un proveedor LLM dedicado entre al
 * pipeline (Claude/GPT que clasifique), este archivo se vuelve la baseline
 * que sobreescribe (mantiene comportamiento offline / sin API key).
 */

const CTA_PATTERNS = [
  /suscr[ií]bete/i,
  /s[ií]gueme/i,
  /sig[uú]eme/i,
  /link\s+en\s+(la\s+)?bio/i,
  /comenta/i,
  /comparte/i,
  /gu[aá]rdalo/i,
  /haz\s+click/i,
  /haz\s+clic/i,
  /dame\s+like/i,
  /dale\s+like/i,
  /follow\s+me/i,
  /subscribe/i,
  /link\s+in\s+bio/i,
  /comment/i,
  /save\s+this/i,
];

const HOOK_PATTERNS = [
  /^\s*(¿|¡)/, // empieza con interrogación / exclamación
  /si\s+est[aá]s\s+viendo\s+esto/i,
  /imagina/i,
  /¿sab[ií]as\s+que/i,
  /\?\s*$/, // termina en pregunta
  /^\s*nadie\s+/i,
  /pocos\s+saben/i,
  /la\s+verdad\s+sobre/i,
];

const OUTRO_PATTERNS = [
  /gracias\s+por\s+(ver|mirar)/i,
  /nos\s+vemos/i,
  /hasta\s+(la|el)\s+pr[oó]xim/i,
  /eso\s+es\s+todo/i,
  /that'?s\s+all/i,
  /see\s+you/i,
];

export type NarrativeHit = 'cta' | 'hook' | 'outro' | null;

/** Devuelve la categoría narrativa más fuerte que matchea, o null. */
export function detectNarrativeRole(text: string): NarrativeHit {
  if (!text) return null;
  const t = text.trim();
  if (CTA_PATTERNS.some((re) => re.test(t))) return 'cta';
  if (OUTRO_PATTERNS.some((re) => re.test(t))) return 'outro';
  if (HOOK_PATTERNS.some((re) => re.test(t))) return 'hook';
  return null;
}
