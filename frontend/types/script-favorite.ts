/**
 * Biblioteca global de Guiones Favoritos (espejo del backend
 * services/script-library.ts). El usuario guarda guiones aprobados y los reusa
 * como few-shot para sesgar la próxima generación.
 */

export interface FavoriteScript {
  id: string;
  name: string;
  title: string;
  style: string;
  summary: string;
  sourcePrompt: string;
  sceneCount: number;
  /** Imágenes de escenas guardadas como ejemplo/referencia (URLs del backend). */
  thumbnails: string[];
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ScriptLibraryRegistry {
  version: 1;
  scripts: FavoriteScript[];
  updatedAt: string;
}

/**
 * Bloque few-shot que se inyecta para que el guion nuevo imite el TONO y la
 * ESTRUCTURA de los favoritos (no que los copie). Mismo espíritu que
 * buildProfileContext.
 */
export function buildFavoritesContext(favorites: FavoriteScript[], max = 3): string | undefined {
  const list = favorites.filter((f) => f.summary.trim()).slice(0, max);
  if (list.length === 0) return undefined;
  const lines: string[] = [
    'Guiones de referencia que al usuario le gustaron (imitá su TONO, ritmo y estructura narrativa; NO copies el contenido literal):',
  ];
  list.forEach((f, i) => {
    const head = [f.title || f.name, f.style].filter(Boolean).join(' · ');
    lines.push(`  ${i + 1}. ${head}\n     ${f.summary.trim().slice(0, 500)}`);
  });
  return lines.join('\n');
}
