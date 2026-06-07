/**
 * Biblioteca de Proyectos (koda-os Scripts flow).
 *
 * El frontend usa un store en sessionStorage que se pierde al cerrar la
 * pestaña. Acá persistimos un snapshot completo del proyecto para poder
 * retomarlo: metadata en `assets/output/koda-projects/registry.json` y el
 * estado entero en `assets/output/koda-projects/<id>.json` (puede ser grande:
 * incluye guion, escenas y referencias en data URLs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('project-library');

const DIR = path.join(OUTPUT_ROOT, 'koda-projects');
const REGISTRY_FILE = path.join(DIR, 'registry.json');

export interface ProjectMeta {
  id: string;
  name: string;
  /** Vista previa del prompt visual. */
  promptPreview: string;
  /** Primera imagen de escena (si existe) para la tarjeta. */
  thumbnailUrl: string | null;
  sceneCount: number;
  hasScript: boolean;
  hasImages: boolean;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRegistry {
  version: 1;
  projects: ProjectMeta[];
  updatedAt: string;
}

const EMPTY: ProjectRegistry = { version: 1, projects: [], updatedAt: '' };

function safeId(id: string): string {
  return id.replace(/[^\w\-.]/g, '_');
}

export function loadRegistry(): ProjectRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { ...EMPTY };
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as ProjectRegistry;
    return {
      version: 1,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch (err) {
    log.error('no se pudo leer koda-projects/registry.json — devuelvo vacío', undefined, err);
    return { ...EMPTY };
  }
}

function saveRegistry(reg: ProjectRegistry): ProjectRegistry {
  const next = { ...reg, version: 1 as const, updatedAt: new Date().toISOString() };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(next, null, 2));
  return next;
}

/** Deriva metadata a partir del state opaco del frontend. */
function deriveMeta(id: string, name: string, state: any, prev?: ProjectMeta): ProjectMeta {
  const scenes: any[] = Array.isArray(state?.scenes) ? state.scenes : [];
  const scriptScenes: any[] = Array.isArray(state?.script?.scenes) ? state.script.scenes : [];
  const firstImg = scenes.find((s) => typeof s?.image_url === 'string' && s.image_url);
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim() || state?.script?.title || 'Proyecto sin título',
    promptPreview: String(state?.form?.visualPrompt ?? '').slice(0, 160),
    thumbnailUrl: firstImg?.image_url ?? null,
    sceneCount: scriptScenes.length || scenes.length,
    hasScript: Boolean(state?.script),
    hasImages: scenes.some((s) => s?.image_url),
    hasVideo: Boolean(state?.videoScenes),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
}

export interface SaveProjectInput {
  /** Si viene, sobrescribe ese proyecto; si no, crea uno nuevo. */
  id?: string;
  name: string;
  state: unknown;
}

export function saveProject(input: SaveProjectInput): ProjectMeta {
  const reg = loadRegistry();
  const id = input.id && reg.projects.some((p) => p.id === input.id) ? input.id : randomUUID();
  const prev = reg.projects.find((p) => p.id === id);
  const meta = deriveMeta(id, input.name, input.state, prev);

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${safeId(id)}.json`), JSON.stringify(input.state ?? {}));

  reg.projects = [meta, ...reg.projects.filter((p) => p.id !== id)];
  saveRegistry(reg);
  log.info(`proyecto guardado id=${id} name="${meta.name}"`);
  return meta;
}

export function getProjectState(id: string): unknown | null {
  const file = path.join(DIR, `${safeId(id)}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    log.error(`no se pudo leer el estado del proyecto ${id}`, undefined, err);
    return null;
  }
}

export function deleteProject(id: string): boolean {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter((p) => p.id !== id);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  try {
    fs.rmSync(path.join(DIR, `${safeId(id)}.json`), { force: true });
  } catch {
    /* ignore */
  }
  log.info(`proyecto borrado id=${id}`);
  return true;
}
