import Link from 'next/link';
import CaptionsEditorStudio from '@/components/editor/CaptionsEditorStudio';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function CaptionsEditorPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projectId = searchParams.projectId;
  const backHref = projectId
    ? `/editor?projectId=${encodeURIComponent(projectId)}`
    : '/editor';

  return (
    <WorkflowShell phase="editor" showCommandBar={false}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--fg-3)] hover:text-[var(--blue-hi)]"
          >
            ← Elegir editor
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg-1)]">
            ✨ Captions <span className="text-[var(--blue-hi)]">Editor</span>
          </h1>
          <p className="mt-0.5 text-sm text-[var(--fg-3)]">
            Subtítulos dinámicos estilo redes sociales sobre un video terminado.
          </p>
        </header>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-6">
          <CaptionsEditorStudio initialProjectId={projectId} />
        </section>

        <p className="mt-6 text-center text-[11px] text-[var(--fg-4)]">
          El proveedor de captions se configura en{' '}
          <Link href="/settings" className="font-semibold text-[var(--blue-hi)] hover:underline">
            ⚙️ Configuración de APIs
          </Link>
          .
        </p>
      </div>
    </WorkflowShell>
  );
}
