/**
 * Aplicación del Caption Engine a una escena.
 *
 *   1. Resegmenta el texto del caption original en chunks de `maxWordsPerLine`.
 *   2. Recalcula timing por palabra preservando la proporción del span original.
 *   3. Inyecta emoji al final del chunk dominante (si autoEmoji).
 *   4. Marca palabras de énfasis (si autoEmphasis).
 *   5. Asigna el `style.id` al caption.
 *
 * El render (ffmpeg/Remotion) lee `style` + `words[]` con sus flags para
 * generar el output final. La marca de énfasis va en `metadata` de la palabra
 * (extensión no-breaking: el render legacy lo ignora si no la conoce).
 */
import type { Scene, SceneCaption, SceneWord } from '../../types/scene';
import { newCaptionId } from '../../utils/ids';
import { detectEmphasis } from './emphasis';
import { suggestEmoji, type EmojiRule } from './emoji';
import type { CaptionStyle } from './styles';

export interface CaptionProcessOptions {
  style: CaptionStyle;
  emojiMap?: EmojiRule[];
}

/** Extiende SceneWord con metadata UI-only (no rompe el shape original). */
type RichWord = SceneWord & {
  emphasis?: boolean;
};

function rechunkWords(words: SceneWord[], maxPerLine: number): SceneWord[][] {
  if (!maxPerLine || maxPerLine <= 0) return [words];
  const chunks: SceneWord[][] = [];
  for (let i = 0; i < words.length; i += maxPerLine) {
    chunks.push(words.slice(i, i + maxPerLine));
  }
  return chunks;
}

/** Devuelve nuevos `captions` para una escena según el preset de estilo. */
export function applyCaptionStyle(
  scene: Scene,
  options: CaptionProcessOptions
): SceneCaption[] {
  const { style, emojiMap } = options;
  const out: SceneCaption[] = [];

  for (const cap of scene.captions) {
    const words = cap.words.length > 0 ? cap.words : tokenizeUniform(cap);
    const chunks = rechunkWords(words, style.layout.maxWordsPerLine);

    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      const startFrame = chunk[0].startFrame;
      const endFrame = chunk[chunk.length - 1].endFrame;
      const tokens = chunk.map((w) => w.text);

      const emphasisIdx = style.autoEmphasis
        ? new Set(detectEmphasis(tokens))
        : new Set<number>();

      const richWords: RichWord[] = chunk.map((w, i) => ({
        ...w,
        ...(emphasisIdx.has(i) ? { emphasis: true } : {}),
      }));

      let text = tokens.join(' ');
      if (style.autoEmoji) {
        const emoji = suggestEmoji(text, emojiMap);
        if (emoji && !text.includes(emoji)) {
          text = `${text} ${emoji}`;
        }
      }

      out.push({
        id: newCaptionId(scene.sceneNumber),
        text,
        startFrame,
        endFrame,
        style: style.id,
        words: richWords,
      });
    }
  }

  return out;
}

/**
 * Si el caption no traía word-timing (sólo texto + start/end), reparte el
 * span de forma uniforme entre tokens.
 */
function tokenizeUniform(cap: SceneCaption): SceneWord[] {
  const tokens = cap.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(cap.endFrame - cap.startFrame, 1);
  const per = span / tokens.length;
  return tokens.map((tok, i) => ({
    text: tok,
    startFrame: Math.round(cap.startFrame + per * i),
    endFrame: Math.round(cap.startFrame + per * (i + 1)),
  }));
}
