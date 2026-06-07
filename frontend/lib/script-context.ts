/**
 * Composición del contexto de generación de guiones.
 *
 * Reúne las distintas fuentes de sesgo en los dos campos que entiende el
 * backend (generate-script):
 *   - profileContext  ← perfil/dominio + guiones favoritos (few-shot)
 *   - styleContext    ← preset de estética + estilo visual guardado
 *
 * Usado por PromptScreen (generar) y ReviewScreen (regenerar) para no duplicar.
 */
import { buildProfileContext } from './profiles';
import { buildAestheticContext } from '@/types/aesthetic';
import { buildStyleContext } from '@/types/visual-style';
import { buildFavoritesContext } from '@/types/script-favorite';
import type { Profile } from '@/types/profile';
import type { VisualStyle } from '@/types/visual-style';
import type { FavoriteScript } from '@/types/script-favorite';

export interface ScriptContextSources {
  profile?: Profile | null;
  aestheticId?: string | null;
  savedStyle?: VisualStyle | null;
  favorites?: FavoriteScript[];
}

export function buildScriptGenerationContext(
  src: ScriptContextSources,
): { profileContext?: string; styleContext?: string } {
  const profileBlocks = [
    src.profile ? buildProfileContext(src.profile) : undefined,
    src.favorites && src.favorites.length > 0 ? buildFavoritesContext(src.favorites) : undefined,
  ].filter((s): s is string => Boolean(s && s.trim()));

  const styleBlocks = [
    buildAestheticContext(src.aestheticId),
    src.savedStyle ? buildStyleContext(src.savedStyle) : undefined,
  ].filter((s): s is string => Boolean(s && s.trim()));

  return {
    profileContext: profileBlocks.length > 0 ? profileBlocks.join('\n\n') : undefined,
    styleContext: styleBlocks.length > 0 ? styleBlocks.join('\n\n') : undefined,
  };
}
