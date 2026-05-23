/**
 * Cliente del edit-plan (autosave del Hub de Assets).
 */
import type { EditPlan } from '@/types/edit-plan';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function getEditPlan(
  projectId: string
): Promise<{ plan: EditPlan; fresh: boolean }> {
  const res = await fetch(
    `${BACKEND_URL}/api/edit-plan/${encodeURIComponent(projectId)}`
  );
  if (!res.ok) throw new Error(`No se pudo cargar el edit-plan (HTTP ${res.status})`);
  return (await res.json()) as { plan: EditPlan; fresh: boolean };
}

export async function saveEditPlan(
  projectId: string,
  patch: Partial<EditPlan>
): Promise<EditPlan> {
  const res = await fetch(
    `${BACKEND_URL}/api/edit-plan/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) throw new Error(`No se pudo guardar el edit-plan (HTTP ${res.status})`);
  const body = (await res.json()) as { plan: EditPlan };
  return body.plan;
}
