/**
 * Aplica el `AnimationPack` a una escena.
 *
 * Materializa 2 SceneEffect:
 *   - kind:'caption-animation' params:{entry, exit, perWord}
 *   - kind:'clip-animation'    params:{entry}
 *
 * El render los lee al construir las composiciones. Si ya había un effect
 * del mismo kind, se sobreescribe (un solo pack activo por escena).
 */
import type { Scene } from '@/editing';
import { newEffectId } from '@/editing';
import type { AnimationPack } from '../configs/animations';

const KINDS = ['caption-animation', 'clip-animation'];

export function applyAnimations(scene: Scene, pack: AnimationPack): Scene {
  const filtered = scene.effects.filter((e) => !KINDS.includes(e.kind));
  return {
    ...scene,
    effects: [
      ...filtered,
      {
        id: newEffectId('caption-animation'),
        kind: 'caption-animation',
        params: { ...pack.captions } as unknown as Record<string, unknown>,
      },
      {
        id: newEffectId('clip-animation'),
        kind: 'clip-animation',
        params: { entry: pack.clipEntry },
      },
    ],
  };
}
