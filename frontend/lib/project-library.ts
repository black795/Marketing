/**
 * Cliente de la Biblioteca de Proyectos (guardar/retomar el flujo de Scripts).
 */
import type { ProjectState } from '@/components/koda-os/project-store';
import { EMPTY_CAROUSEL_REFERENCES } from '@/types/carousel';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * Devuelve una copia del estado SIN las imágenes pesadas (data URLs y URLs de
 * escenas/videos). Conserva guion, prompts y config. Útil para guardar un
 * proyecto liviano cuando el usuario no quiere arrastrar las imágenes.
 */
export function stripProjectImages(state: ProjectState): ProjectState {
  const clearScenes = <T extends { image_url?: string | null }>(arr: T[] | null | undefined) =>
    Array.isArray(arr) ? arr.map((s) => ({ ...s, image_url: null })) : arr ?? null;

  return {
    ...state,
    form: { ...state.form, references: [] },
    script: state.script
      ? { ...state.script, scenes: clearScenes(state.script.scenes) ?? state.script.scenes }
      : state.script,
    scenes: clearScenes(state.scenes),
    sceneHistory: {},
    videoScenes: null,
    carouselReferences: EMPTY_CAROUSEL_REFERENCES,
    carousels: Array.isArray(state.carousels)
      ? state.carousels.map((c) => ({
          ...c,
          slides: c.slides.map((sl) => ({ ...sl, imageUrl: null, imageMeta: undefined })),
        }))
      : state.carousels,
  };
}

export interface ProjectMeta {
  id: string;
  name: string;
  promptPreview: string;
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as { success: boolean; error?: string } & T;
  if (!res.ok || !data.success) throw new Error(data.error || `Backend respondió ${res.status}`);
  return data;
}

export async function fetchProjects(): Promise<ProjectRegistry> {
  const { registry } = await api<{ registry: ProjectRegistry }>('/projects');
  return registry;
}

export async function getProjectState(id: string): Promise<ProjectState> {
  const { state } = await api<{ state: ProjectState }>(`/projects/${encodeURIComponent(id)}`);
  return state;
}

export async function saveProjectSnapshot(input: {
  id?: string | null;
  name: string;
  state: ProjectState;
}): Promise<ProjectMeta> {
  const { project } = await api<{ project: ProjectMeta }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ id: input.id ?? undefined, name: input.name, state: input.state }),
  });
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
