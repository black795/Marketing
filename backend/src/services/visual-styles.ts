/**
 * Persistencia de la Biblioteca de Estilos Visuales.
 *
 * `assets/output/styles/registry.json` con todos los estilos. Las imágenes
 * (referencias + thumbnail) se guardan en `assets/output/styles/assets/<id>/`.
 * Mismo patrón que services/profiles.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('visual-styles');

const STYLES_DIR = path.join(OUTPUT_ROOT, 'styles');
const REGISTRY_FILE = path.join(STYLES_DIR, 'registry.json');
const ASSETS_DIR = path.join(STYLES_DIR, 'assets');

const PUBLIC_BASE_URL = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';

export type StyleRefKind = 'producto' | 'logo' | 'branding' | 'ejemplo' | 'captura' | 'mockup';

export interface VisualStyleReference {
  id: string;
  tipo: StyleRefKind;
  url: string;
  nombre?: string;
}

export interface VisualStyle {
  id: string;
  name: string;
  styleNote: string;
  samplePrompts: string[];
  references: VisualStyleReference[];
  thumbnailUrl: string | null;
  source?: { platform?: string; type?: string; objective?: string };
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface VisualStyleRegistry {
  version: 1;
  styles: VisualStyle[];
  updatedAt: string;
}

const EMPTY: VisualStyleRegistry = { version: 1, styles: [], updatedAt: '' };

// --- IO ---------------------------------------------------------------------

export function loadStyles(): VisualStyleRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { ...EMPTY };
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as VisualStyleRegistry;
    return {
      version: 1,
      styles: Array.isArray(parsed.styles) ? parsed.styles : [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch (err) {
    log.error('no se pudo leer styles/registry.json — devuelvo vacío', undefined, err);
    return { ...EMPTY };
  }
}

function save(reg: VisualStyleRegistry): VisualStyleRegistry {
  const next = { ...reg, version: 1 as const, updatedAt: new Date().toISOString() };
  fs.mkdirSync(STYLES_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(next, null, 2));
  return next;
}

// --- Imágenes (referencias + thumbnail) -------------------------------------

const _DATA_URL = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$/s;
const _EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Persiste una imagen (data:/http/ruta /assets) y devuelve su URL pública. */
export async function persistStyleImage(src: string, styleId: string, name: string): Promise<string> {
  if (src.startsWith('/assets/')) return `${PUBLIC_BASE_URL}${src}`;
  if (src.startsWith(`${PUBLIC_BASE_URL}/assets/`)) return src;

  const safe = styleId.replace(/[^\w\-.]/g, '_');
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
    if (!resp.ok) throw new Error(`descarga de imagen de estilo falló: HTTP ${resp.status}`);
    bytes = Buffer.from(await resp.arrayBuffer());
    const ct = (resp.headers.get('content-type') ?? '').split(';')[0].trim();
    ext = _EXT[ct] ?? 'jpg';
  } else {
    throw new Error('imagen debe ser data: URL, http(s) URL o ruta /assets');
  }

  const file = `${name}_${randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(dir, file), bytes);
  return `${PUBLIC_BASE_URL}/assets/output/styles/assets/${safe}/${file}`;
}

// --- CRUD -------------------------------------------------------------------

export function getStyle(id: string): VisualStyle | null {
  return loadStyles().styles.find((s) => s.id === id) ?? null;
}

export interface CreateStyleInput {
  name: string;
  styleNote?: string;
  samplePrompts?: string[];
  references?: { tipo: StyleRefKind; url: string; nombre?: string }[];
  thumbnail?: string | null;
  source?: { platform?: string; type?: string; objective?: string };
}

export async function createStyle(input: CreateStyleInput): Promise<VisualStyle> {
  const reg = loadStyles();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Persistir referencias.
  const references: VisualStyleReference[] = [];
  const refsIn = input.references ?? [];
  for (let i = 0; i < refsIn.length; i++) {
    const r = refsIn[i];
    try {
      const url = await persistStyleImage(r.url, id, `ref_${String(i).padStart(2, '0')}`);
      references.push({ id: randomUUID(), tipo: r.tipo, url, nombre: r.nombre });
    } catch (err) {
      log.warn(`no se pudo persistir referencia ${i} del estilo`, undefined);
    }
  }

  // Persistir thumbnail.
  let thumbnailUrl: string | null = null;
  if (input.thumbnail) {
    try {
      thumbnailUrl = await persistStyleImage(input.thumbnail, id, 'thumb');
    } catch {
      thumbnailUrl = null;
    }
  }

  const style: VisualStyle = {
    id,
    name: input.name,
    styleNote: input.styleNote ?? '',
    samplePrompts: (input.samplePrompts ?? []).filter(Boolean).slice(0, 6),
    references,
    thumbnailUrl,
    source: input.source,
    stats: { uses: 0, lastUsedAt: null },
    createdAt: now,
    updatedAt: now,
  };

  reg.styles = [...reg.styles, style];
  save(reg);
  log.info(`estilo guardado id=${id} name="${style.name}" refs=${references.length}`);
  return style;
}

export function deleteStyle(id: string): boolean {
  const reg = loadStyles();
  const before = reg.styles.length;
  reg.styles = reg.styles.filter((s) => s.id !== id);
  if (reg.styles.length === before) return false;
  save(reg);
  log.info(`estilo borrado id=${id}`);
  return true;
}

export function recordUse(id: string): VisualStyle | null {
  const reg = loadStyles();
  const idx = reg.styles.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  reg.styles[idx] = {
    ...reg.styles[idx],
    stats: { uses: reg.styles[idx].stats.uses + 1, lastUsedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
  save(reg);
  return reg.styles[idx];
}

export interface UpdateStyleInput {
  name?: string;
  styleNote?: string;
  /** Referencias a APPENDEAR (se persisten como las nuevas). */
  addReferences?: { tipo: StyleRefKind; url: string; nombre?: string }[];
  /** Sample prompts a APPENDEAR. */
  addSamplePrompts?: string[];
}

/** Edita un estilo: renombra, cambia nota y/o suma referencias y ejemplos. */
export async function updateStyle(id: string, input: UpdateStyleInput): Promise<VisualStyle | null> {
  const reg = loadStyles();
  const idx = reg.styles.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const cur = reg.styles[idx];

  const newRefs: VisualStyleReference[] = [];
  const refsIn = input.addReferences ?? [];
  for (let i = 0; i < refsIn.length; i++) {
    const r = refsIn[i];
    try {
      const url = await persistStyleImage(r.url, id, `ref_${Date.now()}_${i}`);
      newRefs.push({ id: randomUUID(), tipo: r.tipo, url, nombre: r.nombre });
    } catch {
      log.warn(`no se pudo persistir referencia nueva ${i} del estilo ${id}`, undefined);
    }
  }

  let thumbnailUrl = cur.thumbnailUrl;
  if (!thumbnailUrl && newRefs.length > 0) thumbnailUrl = newRefs[0].url;

  const updated: VisualStyle = {
    ...cur,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : cur.name,
    styleNote: typeof input.styleNote === 'string' ? input.styleNote : cur.styleNote,
    references: [...cur.references, ...newRefs],
    samplePrompts: [...cur.samplePrompts, ...(input.addSamplePrompts ?? []).filter(Boolean)].slice(0, 12),
    thumbnailUrl,
    updatedAt: new Date().toISOString(),
  };

  reg.styles[idx] = updated;
  save(reg);
  log.info(`estilo actualizado id=${id} +${newRefs.length} refs`);
  return updated;
}
