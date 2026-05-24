/**
 * Mapeo keyword → emoji para inserción automática en captions.
 *
 * El usuario edita esta tabla (o le pasa otra al engine) para cambiar la
 * personalidad del proyecto: viral, profesional, anime, gaming, etc.
 */

export interface EmojiRule {
  /** Regex o palabra exacta (case-insensitive). */
  match: RegExp;
  emoji: string;
}

/** Mapping default — viral / motivacional. */
export const DEFAULT_EMOJI_MAP: EmojiRule[] = [
  { match: /\b(dinero|money|cash|pago|pagar)\b/i, emoji: '💰' },
  { match: /\b(fuego|fire|🔥|flama|caliente|hot)\b/i, emoji: '🔥' },
  { match: /\b(idea|insight|aprende|learn)\b/i, emoji: '💡' },
  { match: /\b(amor|love|coraz[oó]n|heart)\b/i, emoji: '❤️' },
  { match: /\b(viral|trend|tend(en)?cia)\b/i, emoji: '📈' },
  { match: /\b(c[oó]digo|code|programar|developer|dev)\b/i, emoji: '💻' },
  { match: /\b(reto|challenge|imposible|hard)\b/i, emoji: '🎯' },
  { match: /\b(escucha|listen|atenci[oó]n)\b/i, emoji: '👀' },
  { match: /\b(boom|impacto|explosi[oó]n|crash)\b/i, emoji: '💥' },
  { match: /\b(ganar|win|victoria|champion)\b/i, emoji: '🏆' },
  { match: /\b(perd[ie]|loser|fail|fracas)\b/i, emoji: '💀' },
  { match: /\b(secreto|hidden|nadie\s+sabe|truth)\b/i, emoji: '🤫' },
  { match: /\b(parar|stop|alto|wait)\b/i, emoji: '✋' },
  { match: /\b(r[aá]pido|fast|quick|veloz)\b/i, emoji: '⚡' },
  { match: /\b(noche|night|dark)\b/i, emoji: '🌙' },
  { match: /\b(d[ií]a|sun|sol|brillante)\b/i, emoji: '☀️' },
];

/**
 * Encuentra el primer emoji aplicable al texto. Si encuentra varios, gana
 * el que aparece más tarde en el texto (suele ser el "punch" del enunciado).
 */
export function suggestEmoji(text: string, map: EmojiRule[] = DEFAULT_EMOJI_MAP): string | null {
  let best: { emoji: string; lastIndex: number } | null = null;
  for (const rule of map) {
    const m = text.match(rule.match);
    if (m && typeof m.index === 'number') {
      if (!best || m.index >= best.lastIndex) {
        best = { emoji: rule.emoji, lastIndex: m.index };
      }
    }
  }
  return best?.emoji ?? null;
}
