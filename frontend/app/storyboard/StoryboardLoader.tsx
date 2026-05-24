'use client';

import Link from 'next/link';
import { useStoryboardProject } from '@/storyboard';
import { StoryboardProvider, StoryboardPanel } from '@/storyboard';
import { RegenQueueProvider, RegenQueuePanel } from '@/regeneration';
import Spinner from '@/components/loading/Spinner';

/**
 * Componente cliente que carga el proyecto desde el backend (con fallback al
 * timeline legacy) y monta el panel envuelto en su Provider.
 *
 * Se separa de la page por el shape SSR/CSR de Next.js: la page server
 * extrae el projectId del query y delega el resto al cliente.
 */
export default function StoryboardLoader({
  projectId,
}: {
  projectId: string | null;
}) {
  const { status, project, error } = useStoryboardProject(projectId);

  if (!projectId) {
    return (
      <EmptyState
        title="Sin proyecto"
        body="Abre el storyboard pasando ?projectId=… en la URL. Lo normal es entrar desde Scripts → Continuar al editor → Storyboard."
      />
    );
  }
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-neutral-500">
        <Spinner size={18} className="text-brand-pink" />
        Cargando proyecto…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <EmptyState
        title="No se pudo cargar"
        body={error ?? 'Error desconocido'}
        tone="error"
      />
    );
  }
  if (status === 'empty' || !project) {
    return (
      <EmptyState
        title="Proyecto sin escenas"
        body="Genera un guion + imágenes desde Scripts antes de abrir el storyboard."
      />
    );
  }

  return (
    <StoryboardProvider initialProject={project}>
      <RegenQueueProvider>
        <div className="space-y-3">
          <StoryboardPanel />
          <RegenQueuePanel />
        </div>
      </RegenQueueProvider>
    </StoryboardProvider>
  );
}

function EmptyState({
  title,
  body,
  tone = 'neutral',
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'error';
}) {
  const cls =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-neutral-200 bg-white text-neutral-700';
  return (
    <div
      className={`mx-auto mt-10 max-w-md rounded-lg border px-6 py-8 text-center shadow-sm ${cls}`}
    >
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
      <Link
        href="/scripts"
        className="mt-4 inline-block rounded-md bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-600"
      >
        Ir a Scripts
      </Link>
    </div>
  );
}
