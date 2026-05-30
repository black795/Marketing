/**
 * Persistencia del Registro de Avatares — memoria de personajes por marca.
 *
 * Un único archivo `assets/output/avatars/registry.json` con todas las marcas y
 * avatares (datos pequeños: texto + URLs de imágenes, NO los binarios). Las
 * imágenes de referencia se guardan aparte en `assets/output/avatars/refs/...`
 * y en el JSON solo viven sus rutas estáticas.
 *
 * El backend trata la identidad como casi-opaca: el shape vivo está en
 * frontend/types/avatar-registry.ts. Aquí solo aseguramos ids, timestamps y la
 * integridad de las relaciones marca↔avatar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('avatar-registry');

const AVATARS_DIR = path.join(OUTPUT_ROOT, 'avatars');
const REGISTRY_FILE = path.join(AVATARS_DIR, 'registry.json');
const REFS_DIR = path.join(AVATARS_DIR, 'refs');

// --- Shapes (espejo laxo de frontend/types/avatar-registry.ts) --------------

export interface AvatarIdentity {
  primaryImageUrl: string;
  referenceImages: string[];
  loraModelId: string | null;
  voice: string;
  voiceLanguage: string;
  voicePrompt: string;
  videoPrompt: string;
  resolution: string;
  seed: number | null;
  modelId: string | null;
  personaNotes: string;
}

export interface Avatar {
  id: string;
  brandId: string;
  name: string;
  identity: AvatarIdentity;
  createdAt: string;
  updatedAt: string;
  stats: { generations: number; lastUsedAt: string | null };
}

export interface Brand {
  id: string;
  name: string;
  createdAt: string;
}

export interface AvatarRegistry {
  version: 1;
  brands: Brand[];
  avatars: Avatar[];
  updatedAt: string;
}

const EMPTY: AvatarRegistry = { version: 1, brands: [], avatars: [], updatedAt: '' };

// --- IO ---------------------------------------------------------------------

export function loadRegistry(): AvatarRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { ...EMPTY };
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as AvatarRegistry;
    return {
      version: 1,
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch (err) {
    log.error('no se pudo leer registry.json — devuelvo vacío', undefined, err);
    return { ...EMPTY };
  }
}

function saveRegistry(reg: AvatarRegistry): AvatarRegistry {
  const next = { ...reg, version: 1 as const, updatedAt: new Date().toISOString() };
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(next, null, 2));
  return next;
}

// --- Imágenes de referencia -------------------------------------------------

const _DATA_URL = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$/s;
const _EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Guarda una imagen (data: URL o http(s)) bajo refs/<avatarId>/ y devuelve su
 * ruta estática. Si ya es una ruta estática nuestra (/assets/...), la respeta.
 */
export async function persistReferenceImage(
  src: string,
  avatarId: string,
  index: number
): Promise<string> {
  if (src.startsWith('/assets/')) return src; // ya persistida

  const dir = path.join(REFS_DIR, avatarId.replace(/[^\w\-.]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });

  let bytes: Buffer;
  let ext = 'jpg';
  const m = _DATA_URL.exec(src);
  if (m?.groups) {
    bytes = Buffer.from(m.groups.data, 'base64');
    ext = _EXT[m.groups.mime] ?? 'jpg';
  } else if (src.startsWith('http://') || src.startsWith('https://')) {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error(`descarga de referencia falló: HTTP ${resp.status}`);
    bytes = Buffer.from(await resp.arrayBuffer());
    const ct = (resp.headers.get('content-type') ?? '').split(';')[0].trim();
    ext = _EXT[ct] ?? 'jpg';
  } else {
    throw new Error('imagen debe ser data: URL, http(s) URL o ruta /assets ya persistida');
  }

  const file = `ref_${String(index).padStart(2, '0')}_${randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(dir, file), bytes);
  return `/assets/output/avatars/refs/${avatarId.replace(/[^\w\-.]/g, '_')}/${file}`;
}

// --- CRUD Marcas ------------------------------------------------------------

export function upsertBrand(input: { id?: string; name: string }): Brand {
  const reg = loadRegistry();
  const existing = input.id ? reg.brands.find((b) => b.id === input.id) : undefined;
  const brand: Brand = existing
    ? { ...existing, name: input.name }
    : { id: input.id ?? randomUUID(), name: input.name, createdAt: new Date().toISOString() };
  reg.brands = [...reg.brands.filter((b) => b.id !== brand.id), brand];
  saveRegistry(reg);
  log.info(`marca guardada id=${brand.id} name="${brand.name}"`);
  return brand;
}

export function deleteBrand(brandId: string): { removedAvatars: number } {
  const reg = loadRegistry();
  const removedAvatars = reg.avatars.filter((a) => a.brandId === brandId).length;
  reg.brands = reg.brands.filter((b) => b.id !== brandId);
  reg.avatars = reg.avatars.filter((a) => a.brandId !== brandId);
  saveRegistry(reg);
  log.info(`marca borrada id=${brandId} (avatares eliminados=${removedAvatars})`);
  return { removedAvatars };
}

// --- CRUD Avatares ----------------------------------------------------------

export function getAvatar(avatarId: string): Avatar | null {
  return loadRegistry().avatars.find((a) => a.id === avatarId) ?? null;
}

export function upsertAvatar(input: {
  id?: string;
  brandId: string;
  name: string;
  identity: AvatarIdentity;
}): Avatar {
  const reg = loadRegistry();
  if (!reg.brands.some((b) => b.id === input.brandId)) {
    throw new Error(`brandId "${input.brandId}" no existe`);
  }
  const existing = input.id ? reg.avatars.find((a) => a.id === input.id) : undefined;
  const now = new Date().toISOString();
  const avatar: Avatar = {
    id: existing?.id ?? input.id ?? randomUUID(),
    brandId: input.brandId,
    name: input.name,
    identity: input.identity,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    stats: existing?.stats ?? { generations: 0, lastUsedAt: null },
  };
  reg.avatars = [...reg.avatars.filter((a) => a.id !== avatar.id), avatar];
  saveRegistry(reg);
  log.info(`avatar guardado id=${avatar.id} name="${avatar.name}" brand=${avatar.brandId}`);
  return avatar;
}

export function deleteAvatar(avatarId: string): boolean {
  const reg = loadRegistry();
  const before = reg.avatars.length;
  reg.avatars = reg.avatars.filter((a) => a.id !== avatarId);
  if (reg.avatars.length === before) return false;
  saveRegistry(reg);
  log.info(`avatar borrado id=${avatarId}`);
  return true;
}

/**
 * Registra que un avatar se usó para generar (telemetría + gancho del loop de
 * mejora de la Fase 3). Devuelve el avatar actualizado o null si no existe.
 */
export function recordGeneration(avatarId: string): Avatar | null {
  const reg = loadRegistry();
  const idx = reg.avatars.findIndex((a) => a.id === avatarId);
  if (idx < 0) return null;
  const a = reg.avatars[idx];
  reg.avatars[idx] = {
    ...a,
    stats: { generations: a.stats.generations + 1, lastUsedAt: new Date().toISOString() },
  };
  saveRegistry(reg);
  return reg.avatars[idx];
}

export { AVATARS_DIR, REGISTRY_FILE };
