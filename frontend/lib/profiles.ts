/**
 * Cliente del Registro de Perfiles / Dominios de uso.
 *
 * Re-exporta buildProfileContext (vive en types/profile.ts) que es lo que el
 * PromptScreen usa para inyectar el contexto del perfil en generateScript.
 */
import type { Profile, ProfileRegistry, ProfileExampleKind } from '@/types/profile';

export { buildProfileContext } from '@/types/profile';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as { success: boolean; error?: string } & T;
  if (!res.ok || !data.success) throw new Error(data.error || `Backend respondió ${res.status}`);
  return data;
}

export async function fetchProfiles(): Promise<ProfileRegistry> {
  const { registry } = await api<{ registry: ProfileRegistry }>('/profiles');
  return registry;
}

export interface SaveProfileInput {
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

export async function saveProfile(input: SaveProfileInput): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>('/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return profile;
}

export async function removeProfile(id: string): Promise<void> {
  await api(`/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addProfileExample(
  id: string,
  kind: ProfileExampleKind,
  text: string
): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>(`/profiles/${encodeURIComponent(id)}/examples`, {
    method: 'POST',
    body: JSON.stringify({ kind, text }),
  });
  return profile;
}

export async function removeProfileExample(id: string, exampleId: string): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>(
    `/profiles/${encodeURIComponent(id)}/examples/${encodeURIComponent(exampleId)}`,
    { method: 'DELETE' }
  );
  return profile;
}

export async function markProfileUsed(id: string): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>(`/profiles/${encodeURIComponent(id)}/used`, {
    method: 'POST',
  });
  return profile;
}
