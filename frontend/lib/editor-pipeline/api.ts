/**
 * Cliente API del pipeline. Persiste el estado bajo el campo `pipeline` del
 * `editing-project.json`. El backend trata el doc como opaco y hace shallow
 * merge en PUT (ver backend/src/routes/editing-project.ts), así que enviar
 * `{ pipeline: ... }` preserva scenes / tracks / stylePreset existentes.
 */
import {
  DEFAULT_PIPELINE,
  type PipelineState,
  type PipelineSetup,
  type PipelineImports,
  DEFAULT_SETUP,
  DEFAULT_IMPORTS,
  DEFAULT_PHASE_STATUS,
  PHASES,
  type Phase,
  type PhaseStatus,
} from './types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface RawDoc {
  version?: 1;
  projectId?: string;
  pipeline?: unknown;
  [k: string]: unknown;
}

export async function loadPipelineState(
  projectId: string
): Promise<PipelineState | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/editing-project/${encodeURIComponent(projectId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  const body = (await res.json()) as { project: RawDoc };
  return normalizePipeline(body.project?.pipeline);
}

export async function savePipelineState(
  projectId: string,
  state: PipelineState
): Promise<void> {
  const payload = {
    pipeline: { ...state, updatedAt: new Date().toISOString() },
  };
  const res = await fetch(
    `${BACKEND_URL}/api/editing-project/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
}

/**
 * Normaliza un blob opaco al shape vivo. Tolera campos faltantes — la versión
 * del PipelineState puede evolucionar y los proyectos antiguos no deben
 * romperse.
 */
function normalizePipeline(raw: unknown): PipelineState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PipelineState>;
  return {
    currentPhase: isPhase(r.currentPhase) ? r.currentPhase : DEFAULT_PIPELINE.currentPhase,
    status: normalizeStatus(r.status),
    setup: { ...DEFAULT_SETUP, ...(r.setup ?? {}) } as PipelineSetup,
    imports: { ...DEFAULT_IMPORTS, ...(r.imports ?? {}) } as PipelineImports,
    updatedAt: r.updatedAt,
  };
}

function isPhase(x: unknown): x is Phase {
  return typeof x === 'string' && (PHASES as readonly string[]).includes(x);
}

function normalizeStatus(
  s: PipelineState['status'] | undefined
): PipelineState['status'] {
  if (!s) return { ...DEFAULT_PHASE_STATUS };
  const out = { ...DEFAULT_PHASE_STATUS };
  for (const p of PHASES) {
    const v = (s as Record<string, unknown>)[p];
    if (v === 'pending' || v === 'visited' || v === 'completed' || v === 'skipped') {
      out[p] = v as PhaseStatus;
    }
  }
  return out;
}
