/**
 * Aplica un conjunto de `TimingOperation` a una escena concreta.
 *
 * Las operaciones de "silence-remove" y "jump-cut" se materializan como
 * un nuevo `durationFrames` (la escena se acorta). La operación "speed"
 * va al `effects[]` como un efecto declarativo `{kind: 'speed', params: {factor}}`
 * que el render interpretará — no recalcula timing aquí (el render aplica
 * el speed a la reproducción del clip).
 *
 * Mantenemos el shape de la escena consistente; el llamador suele aplicar
 * `recalcFrames` después.
 */
import type { Scene, SceneEffect } from '../../types/scene';
import type { TimingOperation } from './operations';
import { newEffectId } from '../../utils/ids';

export function applyTimingToScene(scene: Scene, ops: TimingOperation[]): Scene {
  let durationFrames = scene.durationFrames;
  const newEffects: SceneEffect[] = [];
  let speedFactor: number | null = null;
  let silenceTrim = 0;
  let jumpCutTrim = 0;

  for (const op of ops) {
    if (op.sceneId !== scene.id) continue;
    switch (op.kind) {
      case 'speed':
        speedFactor = op.speed;
        break;
      case 'silence-remove':
        silenceTrim += Math.max(0, op.rangeEnd - op.rangeStart);
        break;
      case 'jump-cut':
        jumpCutTrim += op.cutDurationFrames;
        break;
      case 'trim':
        durationFrames = op.newDurationFrames;
        break;
    }
  }

  // Aplicar trims acumulados (con piso de 6 frames para no degenerar).
  durationFrames = Math.max(durationFrames - silenceTrim - jumpCutTrim, 6);

  if (speedFactor !== null && speedFactor !== 1.0) {
    // Si ya hay un efecto speed, lo sobreescribimos manteniendo su id.
    const existing = scene.effects.find((e) => e.kind === 'speed');
    if (existing) {
      newEffects.push({
        ...existing,
        params: { factor: speedFactor },
      });
    } else {
      newEffects.push({
        id: newEffectId('speed'),
        kind: 'speed',
        params: { factor: speedFactor },
      });
    }
  }

  // Fusionar efectos: los nuevos sobreescriben los del mismo kind.
  const merged = [
    ...scene.effects.filter((e) => !newEffects.some((n) => n.kind === e.kind)),
    ...newEffects,
  ];

  return {
    ...scene,
    durationFrames,
    effects: merged,
  };
}
