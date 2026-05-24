/**
 * Decide qué SFX añadir a cada escena en base a:
 *   - rol narrativo (hook / cta forzados según preset)
 *   - emoción (vía EmotionMap.sfxIn)
 *   - transición de entrada (whoosh / glitch en cortes rápidos)
 *
 * Devuelve un plan declarativo — el `process.ts` lo materializa como
 * `SceneAudioTrack` añadidos a la escena.
 */
import type { Scene } from '../../types/scene';
import type { SfxPreset } from './presets';
import type { EmotionMap } from '../emotion/map';
import { getDirectives } from '../emotion/map';

export interface SfxInsertion {
  sceneId: string;
  sfxId: string;
  /** Frame relativo dentro de la escena donde arranca el SFX. */
  atFrame: number;
  /** Volumen final (ya con preset.volumeScale aplicado). */
  volume: number;
  reason: string;
}

export function analyzeSfxForScene(
  scene: Scene,
  preset: SfxPreset,
  emotionMap: EmotionMap,
  defaultVolume: number
): SfxInsertion[] {
  if (preset.id === 'off') return [];
  const out: SfxInsertion[] = [];

  // 1) Forzado por rol
  if (preset.forceOnRoles.includes(scene.role)) {
    const id = scene.role === 'cta' ? 'impact' : 'bass-hit';
    out.push({
      sceneId: scene.id,
      sfxId: id,
      atFrame: 0,
      volume: defaultVolume * preset.volumeScale,
      reason: `Role ${scene.role} → ${id}`,
    });
  }

  // 2) Emotion-driven (entrada de escena)
  if (preset.emotionDriven) {
    const dir = getDirectives(emotionMap, scene.emotion);
    if (dir.sfxIn && !out.some((s) => s.sfxId === dir.sfxIn)) {
      out.push({
        sceneId: scene.id,
        sfxId: dir.sfxIn,
        atFrame: 0,
        volume: defaultVolume * preset.volumeScale,
        reason: `Emoción ${scene.emotion} → ${dir.sfxIn}`,
      });
    }
  }

  // 3) Transición de entrada
  if (preset.transitionDriven) {
    const t = scene.transition.inKind;
    let sfxId: string | null = null;
    if (t === 'whip' || t === 'slide-left' || t === 'slide-up') sfxId = 'whoosh';
    else if (t === 'glitch') sfxId = 'glitch';
    else if (t === 'fade' && scene.role === 'hook') sfxId = 'riser';
    if (sfxId && !out.some((s) => s.sfxId === sfxId)) {
      out.push({
        sceneId: scene.id,
        sfxId,
        atFrame: 0,
        volume: defaultVolume * preset.volumeScale,
        reason: `Transición ${t} → ${sfxId}`,
      });
    }
  }

  return out;
}
