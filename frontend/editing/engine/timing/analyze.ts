/**
 * Análisis de timing del proyecto.
 *
 * Sin acceso a audio real, los datos vienen del scene graph:
 *   - duración de la escena
 *   - words[] de los captions (timing por palabra)
 *   - emotion / energy heurística
 *
 * Detecta:
 *   - silencios (gaps entre palabras > silenceThresholdFrames)
 *   - pacing por escena (words/sec)
 *   - hooks (primer scene con role='hook'): sugiere aceleración
 *   - escenas "muertas": sin captions ni emoción fuerte → trim o skip
 */
import type { Scene, TimelineProject } from '../../types';
import type {
  TimingAnalysis,
  TimingOperation,
  SceneTimingMetrics,
} from './operations';
import type { TimingPreset } from './presets';

function emotionEnergy(emotion: Scene['emotion']): number {
  switch (emotion) {
    case 'excited': return 0.9;
    case 'urgent': return 1.0;
    case 'playful': return 0.7;
    case 'inspirational': return 0.5;
    case 'serious': return 0.3;
    case 'calm': return 0.1;
    default: return 0.4;
  }
}

function computeMetrics(scene: Scene, fps: number): SceneTimingMetrics {
  const words = scene.captions.flatMap((c) => c.words);
  const wordCount = words.length;
  const durationSec = scene.durationFrames / fps;
  const wordsPerSecond = durationSec > 0 ? wordCount / durationSec : 0;

  let longestGap = 0;
  let totalSilence = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = Math.max(0, words[i].startFrame - words[i - 1].endFrame);
    if (gap > longestGap) longestGap = gap;
    totalSilence += gap;
  }

  const densityNorm = Math.min(wordsPerSecond / 3.0, 1); // 3 palabras/s ≈ 1.0
  const energy = Math.max(densityNorm, emotionEnergy(scene.emotion));

  return {
    wordCount,
    wordsPerSecond,
    longestGapFrames: longestGap,
    totalSilenceFrames: totalSilence,
    energy,
  };
}

export function analyzeTiming(
  project: TimelineProject,
  preset: TimingPreset
): TimingAnalysis {
  const fps = project.renderConfig.fps;
  const operations: TimingOperation[] = [];
  const metricsByScene: Record<string, SceneTimingMetrics> = {};
  const summaryBits: string[] = [];

  for (const scene of project.scenes) {
    if (!scene.included) continue;
    const metrics = computeMetrics(scene, fps);
    metricsByScene[scene.id] = metrics;

    // 1) Aceleración del hook
    if (scene.role === 'hook' && preset.hookSpeed > 1.0) {
      operations.push({
        kind: 'speed',
        sceneId: scene.id,
        speed: preset.hookSpeed,
        reason: `Hook acelerado a ${preset.hookSpeed.toFixed(2)}x`,
      });
    }

    // 2) Body lento → speed ramp suave hacia el target
    if (
      scene.role !== 'hook' &&
      metrics.wordsPerSecond > 0 &&
      metrics.wordsPerSecond < preset.targetWordsPerSecond &&
      preset.maxSpeed > 1.0
    ) {
      const ratio = preset.targetWordsPerSecond / Math.max(metrics.wordsPerSecond, 0.5);
      const speed = clamp(ratio, preset.minSpeed, preset.maxSpeed);
      if (speed > 1.0) {
        operations.push({
          kind: 'speed',
          sceneId: scene.id,
          speed: Number(speed.toFixed(2)),
          reason: `Acelera de ${metrics.wordsPerSecond.toFixed(1)} a ~${preset.targetWordsPerSecond} w/s`,
        });
      }
    }

    // 3) Silencios largos entre palabras → jump-cut sugerido
    if (metrics.longestGapFrames > preset.silenceThresholdFrames) {
      const words = scene.captions.flatMap((c) => c.words);
      for (let i = 1; i < words.length; i++) {
        const gap = words[i].startFrame - words[i - 1].endFrame;
        if (gap > preset.silenceThresholdFrames) {
          operations.push({
            kind: 'jump-cut',
            sceneId: scene.id,
            atFrame: words[i - 1].endFrame,
            cutDurationFrames: Math.max(gap - 2, 1), // dejamos 2 frames de respiro
            reason: `Silencio de ${gap} frames`,
          });
        }
      }
    }

    // 4) Recorte de bordes
    if (preset.removeEdgeSilence) {
      const words = scene.captions.flatMap((c) => c.words);
      if (words.length > 0) {
        const firstStart = words[0].startFrame - scene.startFrame;
        const lastEnd = scene.endFrame - words[words.length - 1].endFrame;
        if (firstStart > preset.silenceThresholdFrames) {
          operations.push({
            kind: 'silence-remove',
            sceneId: scene.id,
            rangeStart: scene.startFrame,
            rangeEnd: words[0].startFrame,
            reason: `Silencio inicial de ${firstStart} frames`,
          });
        }
        if (lastEnd > preset.silenceThresholdFrames) {
          operations.push({
            kind: 'silence-remove',
            sceneId: scene.id,
            rangeStart: words[words.length - 1].endFrame,
            rangeEnd: scene.endFrame,
            reason: `Silencio final de ${lastEnd} frames`,
          });
        }
      }
    }
  }

  if (operations.length > 0) {
    summaryBits.push(`${operations.length} operaciones de timing sugeridas`);
  } else {
    summaryBits.push('El pacing actual está dentro del preset; sin cambios.');
  }

  return {
    operations,
    summary: summaryBits.join(' · '),
    metricsByScene,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
