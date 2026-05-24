/**
 * Cliente API para `editing-project.json` — scene graph profesional.
 *
 * Las funciones aceptan/devuelven `TimelineProject` (tipos vivos). La capa
 * de red pasa el JSON opaco, por lo que el backend no necesita re-validar.
 */
import type { TimelineProject } from '@/editing';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function loadEditingProject(
  projectId: string
): Promise<TimelineProject | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/editing-project/${encodeURIComponent(projectId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  const body = (await res.json()) as { project: TimelineProject };
  return body.project;
}

export async function saveEditingProject(
  project: TimelineProject
): Promise<TimelineProject> {
  const res = await fetch(
    `${BACKEND_URL}/api/editing-project/${encodeURIComponent(project.projectId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }
  );
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  const body = (await res.json()) as { project: TimelineProject };
  return body.project;
}
