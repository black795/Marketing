import StoryboardLoader from './StoryboardLoader';
import Link from 'next/link';

export default function StoryboardPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projectId = searchParams.projectId ?? null;
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-2.5">
          <Link
            href={projectId ? `/editor?projectId=${encodeURIComponent(projectId)}` : '/'}
            className="text-[11px] font-semibold text-neutral-500 hover:text-brand-pink"
          >
            ← Volver
          </Link>
          <span className="text-sm font-bold text-neutral-900">
            🎬 Storyboard Engine
          </span>
          <span className="text-[11px] text-neutral-400">
            Dirige tus escenas IA — drag & drop, prompt por escena, versionado
          </span>
          <Link
            href={projectId ? `/timeline?projectId=${encodeURIComponent(projectId)}` : '/timeline'}
            className="ml-auto rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
          >
            🎚️ Ver timeline
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-3">
        <StoryboardLoader projectId={projectId} />
      </div>
    </main>
  );
}
