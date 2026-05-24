/**
 * Aplica `ColorGrade` como un `SceneEffect` a cada escena del proyecto.
 *
 * El render (Remotion o ffmpeg) leerá efectos con `kind:'color-grade'` y los
 * traducirá a sus filtros nativos. Los packs visuales que ya tenían un grade
 * previo se sobreescriben (no se acumulan — un proyecto = un look).
 */
import type { Scene } from '@/editing';
import { newEffectId } from '@/editing';
import type { ColorGrade } from '../configs/color-grade';

const KIND = 'color-grade';

export function applyColorGrade(scene: Scene, grade: ColorGrade): Scene {
  const without = scene.effects.filter((e) => e.kind !== KIND);
  return {
    ...scene,
    effects: [
      ...without,
      {
        id: newEffectId(KIND),
        kind: KIND,
        params: { ...grade } as unknown as Record<string, unknown>,
      },
    ],
  };
}
