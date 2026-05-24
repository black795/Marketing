'use client';

import Link from 'next/link';
import { useStoryboardProject, StoryboardProvider } from '@/storyboard';
import { TimelineUiProvider, TimelinePanel } from '@/timeline';
import Spinner from '@/components/loading/Spinner';

export default function TimelineLoader({ projectId }: { projectId: string | null }) {
  const { status, project, error } = useStoryboardProject(projectId);

  if (!projectId) {
    return (
      <EmptyState
        title="Sin proyecto"
        body="Abre el timeline pasando ?projectId=… en la URL. Lo normal es entrar desde Storyboard → Vista timeline."
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
        body="Genera un guion + imágenes desde Scripts antes de abrir el timeline."
      />
    );
  }

  return (
    <StoryboardProvider initialProject={project}>
      <TimelineUiProvider>
        <TimelinePanel />
      </TimelineUiProvider>
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
    <div className={`mx-auto mt-10 max-w-md rounded-lg border px-6 py-8 text-center shadow-sm ${cls}`}>
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
