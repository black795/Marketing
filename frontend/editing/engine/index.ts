/**
 * Auto Editing Engine — el cerebro visual del sistema.
 *
 *   import { runAutoEdit, AUTO_EDIT_PRESETS } from '@/editing/engine';
 *
 *   const { project: next, report } = runAutoEdit(project, preset.config);
 *
 * Submódulos (todos exportados):
 *
 *   captions/    → estilos, emoji, énfasis, applyCaptionStyle
 *   camera/      → presets, pickCameraForScene, applyCameraPreset
 *   timing/      → analyzeTiming, applyTimingToScene, TIMING_PRESETS
 *   sfx/         → SFX_LIBRARY, SFX_PRESETS, analyzeSfxForScene, applySfxToScene
 *   transitions/ → TRANSITION_PRESETS, pickTransitionIn
 *   emotion/     → EmotionMap configurable + presets viral/cinematic/podcast
 *
 * Top-level:
 *
 *   runner.ts    → runAutoEdit (orquesta los 6, devuelve {project, report})
 *   presets.ts   → AUTO_EDIT_PRESETS (TikTok Viral, Hormozi, Cinematic, …)
 */

export * from './captions';
export * from './camera';
export * from './timing';
export * from './sfx';
export * from './transitions';
export * from './emotion';
export * from './presets';
export {
  runAutoEdit,
  type AutoEditReport,
  type RunOptions,
} from './runner';
