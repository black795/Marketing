/**
 * Presets de estilo de edición — alimentan los chips del Hub de Assets.
 *
 * Cada preset sugiere un prompt base, tags y un editor recomendado. Al
 * elegirlo se siembra el formulario (sin pisar lo que el usuario ya tipeó).
 */
export interface EditorPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Prompt sugerido (sembrado si el textarea está vacío). */
  promptSeed: string;
  /** Tags por defecto. */
  tags: string[];
  /** Editor recomendado (id del catálogo en editor-adapters). */
  suggestedEditor: 'remotion' | 'captions';
}

export const EDITOR_PRESETS: EditorPreset[] = [
  {
    id: 'tiktok-fast',
    label: 'TikTok rápida',
    emoji: '⚡',
    description: 'Cortes rápidos, subtítulos grandes, hook fuerte en 0-3s.',
    promptSeed:
      'Edita estilo TikTok viral: cortes cada 1-2s, hook fuerte en los primeros 3 segundos, subtítulos grandes amarillos con keywords resaltadas y zoom-in suave en los puntos clave.',
    tags: ['fast', 'viral', 'hook-strong'],
    suggestedEditor: 'captions',
  },
  {
    id: 'cinematic',
    label: 'Cinematográfica',
    emoji: '🎬',
    description: 'Pacing lento, transiciones suaves, foco en composición.',
    promptSeed:
      'Edición cinematográfica: pacing pausado, transiciones suaves tipo fundido, sin subtítulos invasivos, deja respirar los planos y prioriza la composición.',
    tags: ['slow-pace', 'wide-shots', 'cinematic'],
    suggestedEditor: 'remotion',
  },
  {
    id: 'mrbeast',
    label: 'MrBeast style',
    emoji: '🤯',
    description: 'Energía alta, zooms agresivos, reacciones puntuadas.',
    promptSeed:
      'Estilo MrBeast: energía alta sostenida, zooms agresivos en reacciones, cortes secos, subtítulos puntuando cada palabra clave en mayúsculas.',
    tags: ['high-energy', 'punch-zoom', 'reactions'],
    suggestedEditor: 'captions',
  },
  {
    id: 'minimal',
    label: 'Minimalista',
    emoji: '◻️',
    description: 'Cero adornos, tipografía limpia, una idea por plano.',
    promptSeed:
      'Edición minimalista: una idea por plano, tipografía sans limpia y pequeña, cortes en el silencio, sin transiciones llamativas.',
    tags: ['clean', 'typographic', 'no-fx'],
    suggestedEditor: 'remotion',
  },
  {
    id: 'viral-short',
    label: 'Viral short',
    emoji: '🔥',
    description: 'Vertical 9:16 con loop, cliffhanger al final.',
    promptSeed:
      'Short viral vertical: loop perfecto (inicio = final), cliffhanger en el último plano, subtítulos en estilo karaoke con highlight por palabra.',
    tags: ['loopable', 'cliffhanger', 'karaoke'],
    suggestedEditor: 'captions',
  },
  {
    id: 'podcast-captions',
    label: 'Podcast captions',
    emoji: '🎙️',
    description: 'Habla extensa, subtítulos a 2 líneas, sin cortes raros.',
    promptSeed:
      'Estilo podcast captions: respeta la cadencia del habla, subtítulos limpios a 2 líneas máx., sin cortes ni zooms innecesarios, color sobre fondo translúcido.',
    tags: ['talking-head', 'two-line', 'readable'],
    suggestedEditor: 'captions',
  },
  {
    id: 'anime-edit',
    label: 'Anime edit',
    emoji: '🌀',
    description: 'Beats marcados, flashes, glitches y texto kanji.',
    promptSeed:
      'Anime edit: cortes al beat, flashes blancos en transiciones, glitch puntual en cambios de plano, acentos en kanji decorativos.',
    tags: ['beat-sync', 'glitch', 'aesthetic'],
    suggestedEditor: 'remotion',
  },
];

export function getPreset(id: string | null | undefined): EditorPreset | null {
  if (!id) return null;
  return EDITOR_PRESETS.find((p) => p.id === id) ?? null;
}
