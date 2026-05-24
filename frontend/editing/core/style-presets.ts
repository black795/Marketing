/**
 * Catálogo central de StylePresets del scene graph.
 *
 * Se construye reutilizando el catálogo legacy de `lib/editor-presets` para
 * no duplicar el contenido editorial, pero exponiendo el shape rico que el
 * nuevo `TimelineProject` espera (params estructurados, no sólo prompt seed).
 */
import { EDITOR_PRESETS, type EditorPreset } from '@/lib/editor-presets';
import type { StylePreset } from '../types/project';

function expand(preset: EditorPreset): StylePreset {
  return {
    id: preset.id,
    label: preset.label,
    description: preset.description,
    suggestedEditor: preset.suggestedEditor,
    params: {
      emoji: preset.emoji,
      promptSeed: preset.promptSeed,
      tags: preset.tags,
      // Reservado para iteraciones: typography, palette, captionStyleId, …
    },
  };
}

export const STYLE_PRESETS: StylePreset[] = EDITOR_PRESETS.map(expand);

export function getStylePreset(id: string | null | undefined): StylePreset | null {
  if (!id) return null;
  return STYLE_PRESETS.find((p) => p.id === id) ?? null;
}
