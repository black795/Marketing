/**
 * Reducer del Regen Queue — colección de RegenJob con sus estados.
 *
 * Cap: últimas 50 jobs (FIFO). La UI siempre muestra todas, pero cap evita
 * inflar memoria en sesiones largas. Cancel pone status=cancelled (no quita).
 * Retry resetea el job al estado queued + incrementa attempts.
 */
import type { RegenJob } from '../types/job';
import type { QueueAction } from './actions';

const HISTORY_CAP = 50;

function newId(): string {
  return `regen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface QueueState {
  jobs: RegenJob[];
}

export const initialQueueState: QueueState = { jobs: [] };

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'ENQUEUE': {
      const job: RegenJob = {
        id: newId(),
        sceneId: action.sceneId,
        sceneName: action.sceneName,
        sceneNumber: action.sceneNumber,
        target: action.target,
        options: action.options,
        status: 'queued',
        createdAt: new Date().toISOString(),
        attempts: 1,
      };
      return { jobs: [...state.jobs, job].slice(-HISTORY_CAP) };
    }
    case 'START':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'running', startedAt: new Date().toISOString() }
            : j
        ),
      };
    case 'COMPLETE':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'done', finishedAt: new Date().toISOString(), message: action.message }
            : j
        ),
      };
    case 'FAIL':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'failed', finishedAt: new Date().toISOString(), error: action.error }
            : j
        ),
      };
    case 'CANCEL':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId && (j.status === 'queued' || j.status === 'running')
            ? { ...j, status: 'cancelled', finishedAt: new Date().toISOString() }
            : j
        ),
      };
    case 'RETRY':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? { ...j, status: 'queued', attempts: j.attempts + 1, error: undefined, startedAt: undefined, finishedAt: undefined }
            : j
        ),
      };
    case 'CLEAR_DONE':
      return { jobs: state.jobs.filter((j) => j.status === 'queued' || j.status === 'running') };
    default:
      return state;
  }
}
