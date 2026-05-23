/**
 * Plan de edición de un proyecto — persistido en
 * `assets/output/<projectId>/edit-plan.json`.
 *
 * Es la "configuración del Hub de Assets": qué editor se va a usar, qué
 * preset/estilo, el prompt de edición, qué escenas se incluyen y en qué
 * orden. El frontend lo guarda automáticamente conforme el usuario edita
 * y los editores lo leen al abrirse para arrancar con contexto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('edit-plan');

export interface EditPlan {
  projectId: string;
  /** id del editor elegido (ver catálogo en lib/editor-adapters del frontend). */
  editorId: string;
  /** id del preset de estilo (tiktok-fast, cinematic, …). null = libre. */
  presetId: string | null;
  /** Prompt libre que describe cómo quiere editarse el contenido. */
  prompt: string;
  /** Tags rápidas (viral, fast, …). */
  tags: string[];
  /** scene_numbers a INCLUIR. Lista vacía = incluir todas. */
  includedScenes: number[];
  /** Orden custom de escenas (scene_numbers). Vacío = orden natural. */
  sceneOrder: number[];
  /** Plantilla sugerida cuando editorId === 'captions'. */
  captionTemplateId: string | null;
  /** ISO timestamp del último guardado. */
  updatedAt: string;
}

export function defaultEditPlan(projectId: string): EditPlan {
  return {
    projectId,
    editorId: 'captions',
    presetId: null,
    prompt: '',
    tags: [],
    includedScenes: [],
    sceneOrder: [],
    captionTemplateId: null,
    updatedAt: new Date().toISOString(),
  };
}

function planPath(projectId: string): string {
  const safe = projectId.replace(/[^\w\-.]/g, '_');
  return path.join(OUTPUT_ROOT, safe, 'edit-plan.json');
}

export function loadEditPlan(projectId: string): EditPlan | null {
  try {
    const file = planPath(projectId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as EditPlan;
  } catch (err) {
    log.error(`no se pudo leer el edit-plan de ${projectId}`, undefined, err);
    return null;
  }
}

export function saveEditPlan(plan: EditPlan): EditPlan {
  const next: EditPlan = { ...plan, updatedAt: new Date().toISOString() };
  const file = planPath(plan.projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  log.info(
    `edit-plan guardado projectId=${plan.projectId} editor=${plan.editorId} ` +
      `preset=${plan.presetId ?? '-'} scenes=${plan.includedScenes.length || 'all'}`
  );
  return next;
}
