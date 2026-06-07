/**
 * Cliente de la Biblioteca de Estilos Visuales.
 *
 * Re-exporta buildStyleContext (types/visual-style.ts) que el motor de prompts
 * usa para inyectar el estilo y que el modelo lo imite.
 */
import type { VisualStyle, VisualStyleRegistry } from '@/types/visual-style';
import type { CarouselReferenceKind } from '@/types/carousel';

export { buildStyleContext } from '@/types/visual-style';

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

export async function fetchVisualStyles(): Promise<VisualStyleRegistry> {
  const { registry } = await api<{ registry: VisualStyleRegistry }>('/visual-styles');
  return registry;
}

export interface CreateVisualStyleInput {
  name: string;
  styleNote?: string;
  samplePrompts?: string[];
  references?: { tipo: CarouselReferenceKind; url: string; nombre?: string }[];
  thumbnail?: string | null;
  source?: { platform?: string; type?: string; objective?: string };
}

export async function createVisualStyle(input: CreateVisualStyleInput): Promise<VisualStyle> {
  const { style } = await api<{ style: VisualStyle }>('/visual-styles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return style;
}

export interface UpdateVisualStyleInput {
  name?: string;
  styleNote?: string;
  addReferences?: { tipo: CarouselReferenceKind; url: string; nombre?: string }[];
  addSamplePrompts?: string[];
}

export async function updateVisualStyle(id: string, input: UpdateVisualStyleInput): Promise<VisualStyle> {
  const { style } = await api<{ style: VisualStyle }>(`/visual-styles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return style;
}

export async function deleteVisualStyle(id: string): Promise<void> {
  await api(`/visual-styles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function markVisualStyleUsed(id: string): Promise<VisualStyle> {
  const { style } = await api<{ style: VisualStyle }>(`/visual-styles/${encodeURIComponent(id)}/used`, {
    method: 'POST',
  });
  return style;
}
