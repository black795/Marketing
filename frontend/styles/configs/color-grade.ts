/**
 * ColorGrade — corrección de color del estilo. Se persiste como un SceneEffect
 * `{kind:'color-grade', params:{…}}` que el render (Remotion o ffmpeg
 * `eq=`/`colorbalance=`/`vignette=`/`noise=`) traduce a su pipeline.
 *
 *   saturation     -1..1   0 = identity   (-1 = b/n)
 *   contrast       -1..1   0 = identity
 *   brightness     -1..1   0 = identity
 *   temperature    -1..1   - = cool/azul   + = warm/cálido
 *   tint           -1..1   - = magenta    + = verde
 *   vignette        0..1   intensidad del vignette
 *   grain           0..1   intensidad del film grain
 *   lut             ?      nombre/ruta opcional de un .cube (futuro)
 */
export interface ColorGrade {
  saturation: number;
  contrast: number;
  brightness: number;
  temperature: number;
  tint: number;
  vignette: number;
  grain: number;
  lut?: string;
}

export const IDENTITY_GRADE: ColorGrade = {
  saturation: 0,
  contrast: 0,
  brightness: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  grain: 0,
};
