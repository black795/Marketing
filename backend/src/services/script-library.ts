/**
 * Biblioteca global de Guiones Favoritos.
 *
 * El usuario guarda guiones que aprobó/le gustaron (independiente de Perfiles).
 * Después se seleccionan en Scripts para sesgar la próxima generación como
 * few-shot. Persistencia en `assets/output/scripts/registry.json`.
 * Mismo patrón que services/visual-styles.ts (pero sin imágenes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('script-library');

const SCRIPTS_DIR = path.join(OUTPUT_ROOT, 'scripts');
const REGISTRY_FILE = path.join(SCRIPTS_DIR, 'registry.json');
const ASSETS_DIR = path.join(SCRIPTS_DIR, 'assets');

const PUBLIC_BASE_URL = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';

/** Tope de imágenes guardadas por guion favorito (para acotar el peso). */
const MAX_IMAGES = 8;

export interface FavoriteScript {
  id: string;
  /** Nombre visible (default: título del guion). */
  name: string;
  /** Título original del guion. */
  title: string;
  /** Estilo declarado por el guion (si lo hubo). */
  style: string;
  /** Resumen narrativo compacto usado como few-shot. */
  summary: string;
  /** Prompt visual original con el que se generó (contexto). */
  sourcePrompt: string;
  /** Cantidad de escenas del guion guardado. */
  sceneCount: number;
  /** Imágenes de las escenas guardadas como ejemplo/referencia (URLs públicas). */
  thumbnails: string[];
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ScriptLibraryRegistry {
  version: 1;
  scripts: FavoriteScript[];
  updatedAt: string;
}

const EMPTY: ScriptLibraryRegistry = { version: 1, scripts: [], updatedAt: '' };

// --- IO ---------------------------------------------------------------------

export function loadScripts(): ScriptLibraryRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { ...EMPTY };
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as ScriptLibraryRegistry;
    const scripts = (Array.isArray(parsed.scripts) ? parsed.scripts : []).map((s) => ({
      ...s,
      // Compat: entradas viejas no tenían imágenes.
      thumbnails: Array.isArray(s.thumbnails) ? s.thumbnails : [],
    }));
    return {
      version: 1,
      scripts,
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch (err) {
    log.error('no se pudo leer scripts/registry.json — devuelvo vacío', undefined, err);
    return { ...EMPTY };
  }
}

function save(reg: ScriptLibraryRegistry): ScriptLibraryRegistry {
  const next = { ...reg, version: 1 as const, updatedAt: new Date().toISOString() };
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(next, null, 2));
  return next;
}

// --- Imágenes ---------------------------------------------------------------

const _DATA_URL = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$/s;
const _EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Persiste una imagen (data:/http/ruta /assets) y devuelve su URL pública. */
async function persistScriptImage(src: string, scriptId: string, name: string): Promise<string> {
  if (src.startsWith('/assets/')) return `${PUBLIC_BASE_URL}${src}`;
  if (src.startsWith(`${PUBLIC_BASE_URL}/assets/`)) return src;

  const safe = scriptId.replace(/[^\w\-.]/g, '_');
  const dir = path.join(ASSETS_DIR, safe);
  fs.mkdirSync(dir, { recursive: true });

  let bytes: Buffer;
  let ext = 'jpg';
  const m = _DATA_URL.exec(src);
  if (m?.groups) {
    bytes = Buffer.from(m.groups.data, 'base64');
    ext = _EXT[m.groups.mime] ?? 'jpg';
  } else if (src.startsWith('http://') || src.startsWith('https://')) {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error(`descarga de imagen de guion falló: HTTP ${resp.status}`);
    bytes = Buffer.from(await resp.arrayBuffer());
    const ct = (resp.headers.get('content-type') ?? '').split(';')[0].trim();
    ext = _EXT[ct] ?? 'jpg';
  } else {
    throw new Error('imagen debe ser data: URL, http(s) URL o ruta /assets');
  }

  const file = `${name}_${randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(dir, file), bytes);
  return `${PUBLIC_BASE_URL}/assets/output/scripts/assets/${safe}/${file}`;
}

// --- CRUD -------------------------------------------------------------------

export function getScript(id: string): FavoriteScript | null {
  return loadScripts().scripts.find((s) => s.id === id) ?? null;
}

export interface CreateFavoriteScriptInput {
  name?: string;
  title?: string;
  style?: string;
  summary: string;
  sourcePrompt?: string;
  sceneCount?: number;
  /** Imágenes de escenas a guardar como ejemplo (data:/http/ruta /assets). */
  images?: string[];
}

export async function createScript(input: CreateFavoriteScriptInput): Promise<FavoriteScript> {
  const reg = loadScripts();
  const id = randomUUID();
  const now = new Date().toISOString();
  const title = (input.title ?? '').trim();

  // Persistir imágenes (opcional). Si falla una, se omite — no bloquea.
  const thumbnails: string[] = [];
  const imagesIn = (input.images ?? []).filter((s) => typeof s === 'string' && s).slice(0, MAX_IMAGES);
  for (let i = 0; i < imagesIn.length; i++) {
    try {
      thumbnails.push(await persistScriptImage(imagesIn[i], id, `img_${String(i).padStart(2, '0')}`));
    } catch (err) {
      log.warn(`no se pudo persistir imagen ${i} del guion ${id}`, undefined);
    }
  }

  const fav: FavoriteScript = {
    id,
    name: (input.name ?? title ?? 'Guion sin título').trim() || 'Guion sin título',
    title,
    style: (input.style ?? '').trim(),
    summary: (input.summary ?? '').trim().slice(0, 2000),
    sourcePrompt: (input.sourcePrompt ?? '').trim().slice(0, 1000),
    sceneCount: typeof input.sceneCount === 'number' ? input.sceneCount : 0,
    thumbnails,
    stats: { uses: 0, lastUsedAt: null },
    createdAt: now,
    updatedAt: now,
  };

  reg.scripts = [fav, ...reg.scripts];
  save(reg);
  log.info(`guion favorito guardado id=${id} name="${fav.name}" imgs=${thumbnails.length}`);
  return fav;
}

export function deleteScript(id: string): boolean {
  const reg = loadScripts();
  const before = reg.scripts.length;
  reg.scripts = reg.scripts.filter((s) => s.id !== id);
  if (reg.scripts.length === before) return false;
  save(reg);
  // Borra también las imágenes persistidas del guion.
  try {
    fs.rmSync(path.join(ASSETS_DIR, id.replace(/[^\w\-.]/g, '_')), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  log.info(`guion favorito borrado id=${id}`);
  return true;
}

export function recordUse(id: string): FavoriteScript | null {
  const reg = loadScripts();
  const idx = reg.scripts.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  reg.scripts[idx] = {
    ...reg.scripts[idx],
    stats: { uses: reg.scripts[idx].stats.uses + 1, lastUsedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
  save(reg);
  return reg.scripts[idx];
}
