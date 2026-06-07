/**
 * Cliente de la Biblioteca de Guiones Favoritos.
 */
import type { FavoriteScript, ScriptLibraryRegistry } from '@/types/script-favorite';

export { buildFavoritesContext } from '@/types/script-favorite';

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

export async function fetchFavoriteScripts(): Promise<ScriptLibraryRegistry> {
  const { registry } = await api<{ registry: ScriptLibraryRegistry }>('/script-library');
  return registry;
}

export interface CreateFavoriteScriptInput {
  name?: string;
  title?: string;
  style?: string;
  summary: string;
  sourcePrompt?: string;
  sceneCount?: number;
  /** Imágenes de escenas a guardar como ejemplo (data:/http URLs). */
  images?: string[];
}

export async function createFavoriteScript(input: CreateFavoriteScriptInput): Promise<FavoriteScript> {
  const { script } = await api<{ script: FavoriteScript }>('/script-library', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return script;
}

export async function deleteFavoriteScript(id: string): Promise<void> {
  await api(`/script-library/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function markFavoriteScriptUsed(id: string): Promise<FavoriteScript> {
  const { script } = await api<{ script: FavoriteScript }>(`/script-library/${encodeURIComponent(id)}/used`, {
    method: 'POST',
  });
  return script;
}
