/**
 * Cliente del Registro de Avatares + el puente "trabajar directo con un avatar".
 *
 * `buildAvatarRequest()` es la pieza clave del flujo que pediste: tomas un avatar
 * guardado y, con solo el guion (o un audio), produces el AvatarGenerationRequest
 * completo — imagen, voz, idioma, prompts, seed — todo autocompletado desde su
 * identidad. Así "cada video con ese avatar" sale sin reconfigurar nada.
 */
import type { AvatarGenerationRequest } from '@/types/avatar';
import type { Avatar, AvatarRegistry, Brand } from '@/types/avatar-registry';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as { success: boolean; error?: string } & T;
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Backend respondió ${res.status}`);
  }
  return data;
}

/** Convierte una ruta estática (/assets/...) en URL absoluta para la API de avatar. */
export function toAbsoluteAsset(url: string): string {
  return url.startsWith('/assets/') ? `${BACKEND_URL}${url}` : url;
}

// --- Lectura / escritura ----------------------------------------------------

export async function fetchRegistry(): Promise<AvatarRegistry> {
  const { registry } = await api<{ registry: AvatarRegistry }>('/avatar-registry');
  return registry;
}

export async function saveBrand(input: { id?: string; name: string }): Promise<Brand> {
  const { brand } = await api<{ brand: Brand }>('/avatar-registry/brands', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return brand;
}

export async function removeBrand(brandId: string): Promise<void> {
  await api(`/avatar-registry/brands/${encodeURIComponent(brandId)}`, { method: 'DELETE' });
}

export async function saveAvatar(input: {
  id?: string;
  brandId: string;
  name: string;
  identity: Avatar['identity'];
}): Promise<Avatar> {
  const { avatar } = await api<{ avatar: Avatar }>('/avatar-registry/avatars', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return avatar;
}

export async function removeAvatar(avatarId: string): Promise<void> {
  await api(`/avatar-registry/avatars/${encodeURIComponent(avatarId)}`, { method: 'DELETE' });
}

/** Marca el avatar como usado (telemetría + gancho del loop de mejora futuro). */
export async function markAvatarUsed(avatarId: string): Promise<Avatar> {
  const { avatar } = await api<{ avatar: Avatar }>(
    `/avatar-registry/avatars/${encodeURIComponent(avatarId)}/used`,
    { method: 'POST' }
  );
  return avatar;
}

// --- El puente: avatar → request de generación ------------------------------

/**
 * Construye un AvatarGenerationRequest listo para POST /api/generate-avatar a
 * partir de un avatar guardado. Solo necesitas el guion (TTS) o un audio.
 *
 * Lo que NO se pasa hereda de la identidad del avatar; lo que se pase en
 * `overrides` gana (p.ej. cambiar el guion sin tocar la identidad).
 */
export function buildAvatarRequest(
  avatar: Avatar,
  opts: { voiceScript?: string; audio?: string; overrides?: Partial<AvatarGenerationRequest> }
): AvatarGenerationRequest {
  const id = avatar.identity;
  return {
    model: id.modelId === 'omni_human' ? 'omni_human' : 'p_video_avatar',
    image: toAbsoluteAsset(id.primaryImageUrl),
    resolution: id.resolution,
    voiceScript: opts.voiceScript ?? '',
    audio: opts.audio,
    voice: id.voice,
    voicePrompt: id.voicePrompt,
    voiceLanguage: id.voiceLanguage,
    videoPrompt: id.videoPrompt,
    seed: id.seed,
    disableSafetyFilter: true,
    disablePromptUpsampling: false,
    ...opts.overrides,
  };
}
