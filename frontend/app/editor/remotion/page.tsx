import Link from 'next/link';
import SharedTimelinePanel from '@/components/editor/SharedTimelinePanel';

export default function RemotionEditorPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projectId = searchParams.projectId;
  const backHref = projectId
    ? `/editor?projectId=${encodeURIComponent(projectId)}`
    : '/editor';

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-pink"
          >
            ← Elegir editor
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            🎬 Remotion <span className="text-brand-pink">Editor</span>
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Montaje programático sobre el timeline del proyecto.
          </p>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <SharedTimelinePanel mode="remotion" initialProjectId={projectId} />
        </section>
      </div>
    </main>
  );
}
