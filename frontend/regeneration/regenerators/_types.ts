/** Contrato común de los regeneradores. */
import type { Scene, TimelineProject } from '@/editing';

export interface RegenContext {
  /** Opciones específicas del regenerator (varían por target). */
  options?: Record<string, unknown>;
}

export type Regenerator = (
  scene: Scene,
  project: TimelineProject,
  ctx: RegenContext
) => Partial<Scene>;
