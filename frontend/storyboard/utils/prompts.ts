/**
 * Quick-prompts predefinidos — chips que el usuario aplica con un click
 * y se anexan/sustituyen en el prompt de la escena para regen IA.
 *
 * La regla es simple: si el prompt está vacío → reemplaza; si ya tiene
 * contenido → anexa con un separador ". " para no perder la intención
 * previa del usuario.
 */

export interface QuickPrompt {
  id: string;
  label: string;
  emoji: string;
  /** Texto que se inyecta al prompt. */
  inject: string;
  /** Tag opcional añadido al EditPlan al usarlo. */
  tag?: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'more-dynamic',
    label: 'Más dinámico',
    emoji: '⚡',
    inject: 'Más dinámico: corte más corto, movimiento de cámara más activo, energía alta.',
    tag: 'dynamic',
  },
  {
    id: 'more-zoom',
    label: 'Más zoom',
    emoji: '🔍',
    inject: 'Aplicar zoom-in agresivo hacia el sujeto principal a mitad de la escena.',
    tag: 'zoom',
  },
  {
    id: 'more-emotional',
    label: 'Más emocional',
    emoji: '💫',
    inject: 'Cargar la escena de emoción: luz cálida, encuadre íntimo, música suave de fondo.',
    tag: 'emotional',
  },
  {
    id: 'tiktok-style',
    label: 'Más estilo TikTok',
    emoji: '🔥',
    inject: 'Estilo TikTok viral: hook en el primer segundo, captions amarillas grandes, cortes secos cada 1-2s.',
    tag: 'tiktok',
  },
  {
    id: 'cinematic',
    label: 'Cinematográfico',
    emoji: '🎬',
    inject: 'Pacing pausado, planos amplios, transición de fundido suave, sin captions invasivos.',
    tag: 'cinematic',
  },
  {
    id: 'glitch',
    label: 'Glitch / VHS',
    emoji: '📺',
    inject: 'Añadir overlay de glitch / VHS en la transición de entrada, distorsión de croma.',
    tag: 'glitch',
  },
  {
    id: 'slow-mo',
    label: 'Slow motion',
    emoji: '🐢',
    inject: 'Renderizar este clip a 0.5x speed, mantener audio normal.',
    tag: 'slow-mo',
  },
  {
    id: 'punch-in',
    label: 'Punch-in',
    emoji: '🎯',
    inject: 'Punch-in (crop progresivo hacia el centro) durante toda la duración de la escena.',
    tag: 'punch-in',
  },
];

/** Aplica un quick-prompt al texto actual de prompt de escena. */
export function applyQuickPrompt(currentPrompt: string, qp: QuickPrompt): string {
  const trimmed = currentPrompt.trim();
  if (trimmed.length === 0) return qp.inject;
  // Si el quick-prompt ya estaba aplicado, no duplicar.
  if (trimmed.includes(qp.inject)) return trimmed;
  return `${trimmed} ${qp.inject}`;
}
