/**
 * Detector de palabras de énfasis dentro de una frase de caption.
 *
 * Reglas heurísticas (sin LLM):
 *   - Palabras en mayúsculas que el guion ya escribió así → emphasis.
 *   - Palabras "potentes" del léxico (verbos de acción, números, exclamativos).
 *   - Última palabra de la frase si la oración termina en `!` o `?`.
 *
 * Devuelve los índices (sobre tokens whitespace-split) que deben pintarse
 * en color de highlight.
 */

const POWER_WORDS = new Set([
  // EN
  'now', 'never', 'always', 'free', 'new', 'first', 'last', 'secret',
  'proven', 'shocking', 'best', 'worst', 'million', 'billion', 'huge',
  'easy', 'instant', 'guaranteed',
  // ES
  'ahora', 'nunca', 'siempre', 'gratis', 'nuevo', 'primero', 'último',
  'secreto', 'probado', 'increíble', 'mejor', 'peor', 'millón', 'billón',
  'enorme', 'fácil', 'instantáneo', 'garantizado',
]);

const NUMBER_RE = /^[+-]?\d+([.,]\d+)?[%kKmMxX]?$/;

export function detectEmphasis(tokens: string[]): number[] {
  const out = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[.,!?;:]+$/g, '');
    if (!t) continue;

    // 1. Ya viene en mayúsculas y mide más de una letra → respeto autoral.
    if (t.length > 1 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t)) {
      out.add(i);
      continue;
    }

    // 2. Power words.
    if (POWER_WORDS.has(t.toLowerCase())) {
      out.add(i);
      continue;
    }

    // 3. Números (impacto visual fuerte).
    if (NUMBER_RE.test(t)) {
      out.add(i);
      continue;
    }
  }

  // 4. Última palabra si termina en ! o ?
  const last = tokens[tokens.length - 1];
  if (last && /[!?]$/.test(last) && tokens.length > 0) {
    out.add(tokens.length - 1);
  }

  return [...out].sort((a, b) => a - b);
}
