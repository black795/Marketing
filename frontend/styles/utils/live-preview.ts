/**
 * Live preview — deriva una mini-simulación de cómo quedará una escena al
 * aplicar un StylePack, SIN tocar el proyecto.
 *
 * Devuelve un objeto compacto que el componente de UI traduce a estilos CSS
 * (color grade → filter CSS; animation → clase; overlays → renderiza chips).
 */
import type { Scene, TimelineProject } from '@/editing';
import type { StylePack } from '../configs/style-pack';
import type { ColorGrade } from '../configs/color-grade';

export interface PreviewSnapshot {
  pack: StylePack;
  scene: Scene;
  cssFilter: string;
  vignetteOpacity: number;
  grainOpacity: number;
  captionPreviewText: string;
  /** Estilo CSS inline para el caption (color, font, size relativo). */
  captionStyle: React.CSSProperties;
  overlayCount: number;
  effectKinds: string[];
}

/** Traduce ColorGrade a un `filter:` CSS razonable (no exacto, suficiente para preview). */
export function colorGradeToCss(grade: ColorGrade): string {
  const parts: string[] = [];
  parts.push(`saturate(${(1 + grade.saturation).toFixed(2)})`);
  parts.push(`contrast(${(1 + grade.contrast).toFixed(2)})`);
  parts.push(`brightness(${(1 + grade.brightness).toFixed(2)})`);
  if (grade.temperature !== 0) {
    // Aproximación: temperature → hue-rotate suave (warm = +0 a +12deg, cool = -12 a 0)
    const hue = grade.temperature * 12;
    parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  }
  return parts.join(' ');
}

export function buildPreviewSnapshot(
  project: TimelineProject,
  pack: StylePack
): PreviewSnapshot | null {
  const scene = project.scenes[0];
  if (!scene) return null;

  const captionStyle = pack.autoEdit.captionStyleOverride;
  const captionStyleCss: React.CSSProperties = captionStyle
    ? {
        fontFamily: captionStyle.font.family,
        fontWeight: captionStyle.font.weight,
        color: captionStyle.colors.primary,
        WebkitTextStroke: `${Math.max(1, captionStyle.outlineWidth / 2)}px ${captionStyle.colors.outline}`,
        textTransform: captionStyle.id === 'hormozi' ? 'uppercase' : 'none',
        letterSpacing: captionStyle.font.letterSpacing ? `${captionStyle.font.letterSpacing}px` : undefined,
      }
    : {};

  const captionPreviewText =
    scene.captions[0]?.text?.split(/\s+/).slice(0, 4).join(' ') ?? 'tu hook aquí';

  return {
    pack,
    scene,
    cssFilter: colorGradeToCss(pack.colorGrade),
    vignetteOpacity: pack.colorGrade.vignette,
    grainOpacity: pack.colorGrade.grain,
    captionPreviewText,
    captionStyle: captionStyleCss,
    overlayCount: pack.overlays.filter((o) => o.injectOnRoles.includes(scene.role)).length,
    effectKinds: pack.effects.map((e) => e.kind),
  };
}
