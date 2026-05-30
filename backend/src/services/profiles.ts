/**
 * Persistencia de Perfiles / Dominios de uso.
 *
 * Un único `assets/output/profiles/registry.json` con todos los perfiles.
 * Las referencias visuales se guardan en `assets/output/profiles/refs/<id>/`.
 * Mismo patrón que services/avatar-registry.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('profiles');

const PROFILES_DIR = path.join(OUTPUT_ROOT, 'profiles');
const REGISTRY_FILE = path.join(PROFILES_DIR, 'registry.json');
const REFS_DIR = path.join(PROFILES_DIR, 'refs');

export type ProfileExampleKind = 'prompt' | 'script';

export interface ProfileExample {
  id: string;
  kind: ProfileExampleKind;
  text: string;
  addedAt: string;
}

export interface Profile {
  id: string;
  name: string;
  domain: string;
  systemContext: string;
  tone: string;
  dos: string;
  donts: string;
  avatarIds: string[];
  examples: ProfileExample[];
  referenceImages: string[];
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRegistry {
  version: 1;
  profiles: Profile[];
  updatedAt: string;
}

const EMPTY: ProfileRegistry = { version: 1, profiles: [], updatedAt: '' };

// --- IO ---------------------------------------------------------------------

export function loadProfiles(): ProfileRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { ...EMPTY };
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as ProfileRegistry;
    return {
      version: 1,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch (err) {
    log.error('no se pudo leer profiles/registry.json — devuelvo vacío', undefined, err);
    return { ...EMPTY };
  }
}

function save(reg: ProfileRegistry): ProfileRegistry {
  const next = { ...reg, version: 1 as const, updatedAt: new Date().toISOString() };
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
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

export async function persistReferenceImage(src: string, profileId: string, index: number): Promise<string> {
  if (src.startsWith('/assets/')) return src;
  const safe = profileId.replace(/[^\w\-.]/g, '_');
  const dir = path.join(REFS_DIR, safe);
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
  return `/assets/output/profiles/refs/${safe}/${file}`;
}

// --- CRUD -------------------------------------------------------------------

export function getProfile(id: string): Profile | null {
  return loadProfiles().profiles.find((p) => p.id === id) ?? null;
}

export interface UpsertProfileInput {
  id?: string;
  name: string;
  domain?: string;
  systemContext?: string;
  tone?: string;
  dos?: string;
  donts?: string;
  avatarIds?: string[];
  referenceImages?: string[];
}

export function upsertProfile(input: UpsertProfileInput): Profile {
  const reg = loadProfiles();
  const existing = input.id ? reg.profiles.find((p) => p.id === input.id) : undefined;
  const now = new Date().toISOString();
  const profile: Profile = {
    id: existing?.id ?? input.id ?? randomUUID(),
    name: input.name,
    domain: input.domain ?? existing?.domain ?? '',
    systemContext: input.systemContext ?? existing?.systemContext ?? '',
    tone: input.tone ?? existing?.tone ?? '',
    dos: input.dos ?? existing?.dos ?? '',
    donts: input.donts ?? existing?.donts ?? '',
    avatarIds: input.avatarIds ?? existing?.avatarIds ?? [],
    examples: existing?.examples ?? [],
    referenceImages: input.referenceImages ?? existing?.referenceImages ?? [],
    stats: existing?.stats ?? { uses: 0, lastUsedAt: null },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  reg.profiles = [...reg.profiles.filter((p) => p.id !== profile.id), profile];
  save(reg);
  log.info(`perfil guardado id=${profile.id} name="${profile.name}"`);
  return profile;
}

export function deleteProfile(id: string): boolean {
  const reg = loadProfiles();
  const before = reg.profiles.length;
  reg.profiles = reg.profiles.filter((p) => p.id !== id);
  if (reg.profiles.length === before) return false;
  save(reg);
  log.info(`perfil borrado id=${id}`);
  return true;
}

export function addExample(profileId: string, kind: ProfileExampleKind, text: string): Profile | null {
  const reg = loadProfiles();
  const idx = reg.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;
  const ex: ProfileExample = { id: randomUUID(), kind, text, addedAt: new Date().toISOString() };
  reg.profiles[idx] = {
    ...reg.profiles[idx],
    examples: [...reg.profiles[idx].examples, ex],
    updatedAt: new Date().toISOString(),
  };
  save(reg);
  return reg.profiles[idx];
}

export function removeExample(profileId: string, exampleId: string): Profile | null {
  const reg = loadProfiles();
  const idx = reg.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;
  reg.profiles[idx] = {
    ...reg.profiles[idx],
    examples: reg.profiles[idx].examples.filter((e) => e.id !== exampleId),
    updatedAt: new Date().toISOString(),
  };
  save(reg);
  return reg.profiles[idx];
}

export function recordUse(profileId: string): Profile | null {
  const reg = loadProfiles();
  const idx = reg.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;
  const p = reg.profiles[idx];
  reg.profiles[idx] = {
    ...p,
    stats: { uses: p.stats.uses + 1, lastUsedAt: new Date().toISOString() },
  };
  save(reg);
  return reg.profiles[idx];
}

export { PROFILES_DIR, REGISTRY_FILE };
