/**
 * Cliente del planner automático: prompt → { sceneOrder, captions }.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface AutoPlanCaption {
  text: string;
  startSeconds: number;
  durationSeconds: number;
  style: string;
}

export interface AutoPlan {
  sceneOrder: number[];
  captions: AutoPlanCaption[];
  reasoning: string;
}

export async function getAutoPlan(
  projectId: string,
  prompt: string
): Promise<AutoPlan> {
  const res = await fetch(
    `${BACKEND_URL}/api/auto/plan/${encodeURIComponent(projectId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }
  );
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail);
  }
  const body = (await res.json()) as { plan: AutoPlan };
  return body.plan;
}
