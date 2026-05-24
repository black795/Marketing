/**
 * Regenerator de captions — re-segmenta y re-estiliza los subtítulos.
 *
 * Honra el `stylePresetId` activo de la escena (o del proyecto) para mantener
 * coherencia: si está en TikTok Viral, re-aplica el caption style 'tiktok'.
 * Si no hay style activo, usa el style del primer caption existente o 'default'.
 */
import type { Scene, TimelineProject } from '@/editing';
import {
  applyCaptionStyle,
  getCaptionStyle,
  type CaptionStyle,
} from '@/editing/engine';
import { getStylePack } from '@/styles';
import type { RegenContext } from './_types';

export function regenerateCaptions(
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
): Partial<Scene> {
  if (scene.captions.length === 0) return {};
  const styleId = pickCaptionStyleId(scene, project, ctx);
  const style: CaptionStyle = getCaptionStyle(styleId);
  return {
    captions: applyCaptionStyle(scene, { style }),
  };
}

function pickCaptionStyleId(
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
): string {
  // 1. Override explícito
  const explicit = (ctx.options?.captionStyleId as string | undefined) ?? null;
  if (explicit) return explicit;
  // 2. Style pack del proyecto/escena
  const packId = (scene.stylePresetId ?? project.stylePreset?.id) || null;
  const pack = packId ? getStylePack(packId) : null;
  if (pack?.autoEdit.captionStyleOverride) {
    return pack.autoEdit.captionStyleOverride.id;
  }
  // 3. El estilo actual del primer caption
  return scene.captions[0]?.style || 'tiktok';
}
