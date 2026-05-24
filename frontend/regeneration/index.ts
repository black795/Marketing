/**
 * Tim Koda — Regeneration System.
 *
 * Regen modular por escena: captions, camera, transitions, overlays, effects,
 * sfx, voice, music, scene-completa. Queue con cancel/retry, runner
 * secuencial integrado en el provider, history preservado en el storyboard.
 *
 *   <StoryboardProvider initialProject={...}>
 *     <RegenQueueProvider>
 *       <StoryboardPanel />
 *       <RegenQueuePanel />
 *     </RegenQueueProvider>
 *   </StoryboardProvider>
 */
export { RegenQueueProvider, useRegenQueue } from './queue/context';
export { queueReducer, initialQueueState, type QueueState } from './queue/reducer';
export type { QueueAction } from './queue/actions';
export type { RegenJob, RegenTarget, RegenStatus, TargetMeta } from './types/job';
export { TARGET_METAS } from './types/job';
export { REGENERATORS, type Regenerator, type RegenContext } from './regenerators';
export { RegenTargetMenu, RegenQueuePanel } from './components';
