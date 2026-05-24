/**
 * Persistencia del `editing-project.json` — scene graph profesional.
 *
 * Vive EN PARALELO al `timeline.json` legacy. El render sigue consumiendo
 * `timeline.json` (sin tocar su pipeline); el editor visual y todo lo nuevo
 * trabajan sobre `editing-project.json`. Cuando el frontend guarda el graph,
 * suele también regenerar y reescribir el `timeline.json` desde el graph para
 * mantener coherencia (`toTimelineDocument` en frontend/editing/core).
 *
 * El backend NO valida el shape — el contrato vive en frontend/editing/types
 * y se persiste como JSON opaco. Esto evita duplicar los tipos en TS y deja
 * la lógica de migración del lado del editor, que es quien sabe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('editing-project');

/**
 * Shape mínimo del documento — espejo laxo de `TimelineProject`.
 * El backend sólo se asegura de que `projectId` exista; el resto pasa tal cual.
 */
export interface EditingProjectDoc {
  version: 1;
  projectId: string;
  title?: string;
  scenes?: unknown[];
  tracks?: unknown[];
  stylePreset?: unknown;
  renderConfig?: unknown;
  metadata?: unknown;
  updatedAt?: string;
  /** Campos adicionales — se preservan sin tocar. */
  [k: string]: unknown;
}

function safe(id: string): string {
  return id.replace(/[^\w\-.]/g, '_');
}

function projectPath(projectId: string): string {
  return path.join(OUTPUT_ROOT, safe(projectId), 'editing-project.json');
}

export function loadEditingProject(projectId: string): EditingProjectDoc | null {
  try {
    const file = projectPath(projectId);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as EditingProjectDoc;
    return parsed;
  } catch (err) {
    log.error(`no se pudo leer editing-project de ${projectId}`, undefined, err);
    return null;
  }
}

export function saveEditingProject(doc: EditingProjectDoc): EditingProjectDoc {
  const next: EditingProjectDoc = {
    ...doc,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const file = projectPath(doc.projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  const sceneCount = Array.isArray(next.scenes) ? next.scenes.length : 0;
  log.info(
    `editing-project guardado projectId=${doc.projectId} scenes=${sceneCount}`
  );
  return next;
}

export { OUTPUT_ROOT };
