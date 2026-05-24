/**
 * Análisis de qué cámara aplicar a una escena.
 *
 * Reglas en orden de prioridad:
 *   1. Si la escena tiene `camera.preset` distinto del default → respeto autoral.
 *   2. Si hay keyword fuerte en captions/prompt ("zoom", "boom", "imagina") → match.
 *   3. EmotionMap → directives.camera.
 *   4. Rol narrativo: hook → push-in agresivo, outro → ken-burns.
 *
 * Output: id de un preset de `CAMERA_PRESETS`.
 */
import type { Scene, SceneRole } from '../../types/scene';
import type { EmotionMap } from '../emotion/map';
import { getDirectives } from '../emotion/map';

interface KeywordRule {
  test: RegExp;
  cameraId: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  { test: /\b(zoom|acerca|close[- ]?up)\b/i, cameraId: 'punch-zoom' },
  { test: /\b(boom|explosi|impacto|crash)\b/i, cameraId: 'punch-zoom' },
  { test: /\b(imagina|piensa|recuerda)\b/i, cameraId: 'cinematic-push' },
  { test: /\b(corre|run|escape|rapid)\b/i, cameraId: 'shake' },
  { test: /\b(calma|tranquil|peaceful|relax)\b/i, cameraId: 'ken-burns' },
];

function fromRole(role: SceneRole): string {
  switch (role) {
    case 'hook':
      return 'punch-in-soft';
    case 'cta':
      return 'punch-zoom';
    case 'outro':
      return 'ken-burns';
    case 'intro':
      return 'cinematic-push';
    case 'transition':
      return 'static';
    default:
      return 'slow-zoom';
  }
}

export function pickCameraForScene(
  scene: Scene,
  emotionMap: EmotionMap
): string {
  // 1) Autoral
  if (scene.camera?.preset && scene.camera.preset !== 'static') {
    return scene.camera.preset;
  }

  // 2) Keywords (texto narrado + prompt creativo)
  const text =
    scene.captions.map((c) => c.text).join(' ') + ' ' + (scene.prompt ?? '');
  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(text)) return rule.cameraId;
  }

  // 3) Emoción
  const directives = getDirectives(emotionMap, scene.emotion);
  if (directives.camera) return directives.camera;

  // 4) Rol
  return fromRole(scene.role);
}
