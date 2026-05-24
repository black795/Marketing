/**
 * Aplica el preset de cámara elegido a una escena.
 *
 * Devuelve `{ camera, effects }` que el caller combina con el resto de la
 * escena. NO muta — todo inmutable.
 */
import type { Scene, SceneCamera, SceneEffect } from '../../types/scene';
import { getCameraPreset } from './presets';
import { newEffectId } from '../../utils/ids';

export interface CameraProcessResult {
  camera: SceneCamera;
  /** Nuevos efectos a fusionar con `scene.effects`. */
  effects: SceneEffect[];
}

export function applyCameraPreset(
  scene: Scene,
  presetId: string
): CameraProcessResult {
  const preset = getCameraPreset(presetId);
  const camera = preset.toSceneCamera();
  const effects: SceneEffect[] = [];
  if (preset.extraEffect) {
    // Evitamos duplicar si ya existe un efecto del mismo kind.
    const already = scene.effects.some((e) => e.kind === preset.extraEffect!.kind);
    if (!already) {
      effects.push({
        id: newEffectId(preset.extraEffect.kind),
        kind: preset.extraEffect.kind,
        params: preset.extraEffect.params,
      });
    }
  }
  return { camera, effects };
}
