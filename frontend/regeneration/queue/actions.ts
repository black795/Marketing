import type { RegenJob, RegenTarget } from '../types/job';

export type QueueAction =
  | {
      type: 'ENQUEUE';
      sceneId: string;
      sceneName: string;
      sceneNumber: number;
      target: RegenTarget;
      options?: Record<string, unknown>;
    }
  | { type: 'START'; jobId: string }
  | { type: 'COMPLETE'; jobId: string; message?: string }
  | { type: 'FAIL'; jobId: string; error: string }
  | { type: 'CANCEL'; jobId: string }
  | { type: 'RETRY'; jobId: string }
  | { type: 'CLEAR_DONE' };

export interface QueueSnapshot {
  jobs: RegenJob[];
}
