import ExportLoader from './ExportLoader';
import Link from 'next/link';

export default function ExportPage({
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
          <span className="text-sm font-bold text-neutral-900">📤 Export Pipeline</span>
          <span className="text-[11px] text-neutral-400">
            Render incremental con cache · 7 presets de plataforma · jobs en paralelo
          </span>
          <Link
            href={projectId ? `/storyboard?projectId=${encodeURIComponent(projectId)}` : '/storyboard'}
            className="ml-auto rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
          >
            🎬 Storyboard
          </Link>
        </div>
      </header>

      <div className="mx-auto h-[calc(100vh-3rem)] max-w-[1600px] px-3 py-3">
        <ExportLoader projectId={projectId} />
      </div>
    </main>
  );
}
