import Link from 'next/link';

/**
 * Pantalla de selección de editor — paso "Selección de editor" del flujo:
 *   Prompt → Guion → Assets IA → Timeline → [Selección de editor] →
 *   Remotion Editor / Captions Editor → Preview → Render final.
 *
 * Ambos editores consumen el mismo `timeline.json` (fuente de verdad única).
 */
export default function EditorSelectPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  // El flujo de Scripts pasa el projectId tras "video-result" para que
  // ambos editores reciban el contexto del proyecto sin volver a pedirlo.
  const qs = searchParams.projectId
    ? `?projectId=${encodeURIComponent(searchParams.projectId)}`
    : '';
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <header className="mb-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-pink"
          >
            ← Inicio
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Elige tu <span className="text-brand-pink">editor</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Ambos editores trabajan sobre el mismo timeline del proyecto.
          </p>
        </header>

        <div className="grid flex-1 grid-cols-1 content-center gap-6 md:grid-cols-2 lg:grid-cols-3">
          <EditorCard
            href={`/storyboard${qs}`}
            emoji="🎬"
            title="Storyboard Engine"
            description="Dirige tus escenas IA: grid drag&drop, prompt por escena, versionado y sidebar de materiales."
            accent="pink"
            bullets={['Edición por escena', 'Prompt + regen IA', 'Versionado y autosave']}
          />
          <EditorCard
            href={`/timeline${qs}`}
            emoji="🎚️"
            title="Smart Timeline"
            description="Vista pro tipo Premiere: pistas separadas (video/voz/música/sfx/captions), trim/split/snap, scrubbing, IA actions."
            accent="yellow"
            bullets={['Tracks por categoría', 'Trim · Split · Snap', 'Edit by prompt']}
          />
          <EditorCard
            href={`/styles${qs}`}
            emoji="🎨"
            title="Style Engine"
            description="8 presets virales (TikTok · Hormozi · MrBeast · Podcast · Documental · Gaming · Luxury · Anime) con live preview."
            accent="pink"
            bullets={['8 packs editoriales', 'Prompt-to-style', 'Live preview por escena']}
          />
          <EditorCard
            href={`/editor/remotion${qs}`}
            emoji="🎞️"
            title="Remotion Editor"
            description="Montaje y render programático: escenas, transiciones y efectos compuestos en código React."
            accent="yellow"
            bullets={['Composición por escenas', 'Transiciones y efectos', 'Render server-side']}
          />
          <EditorCard
            href={`/editor/captions${qs}`}
            emoji="✨"
            title="Captions Editor"
            description="Subtítulos dinámicos estilo redes sociales: karaoke, word highlighting y estilos virales."
            accent="pink"
            bullets={['Auto-captions sincronizadas', 'Karaoke y word highlight', 'Estilos virales (TikTok)']}
          />
          <EditorCard
            href={`/export${qs}`}
            emoji="📤"
            title="Export Pipeline"
            description="Render incremental con cache de segmentos · 7 presets de plataforma · jobs paralelos."
            accent="yellow"
            bullets={['Cache por hash', 'Paralelismo configurable', 'TikTok / Reels / Shorts / LinkedIn / 1:1 / 16:9']}
          />
        </div>

        <footer className="mt-10 text-center text-xs text-neutral-400">
          ¿Aún no configuraste el proveedor de captions?{' '}
          <Link href="/settings" className="font-semibold text-brand-pink hover:underline">
            Ir a ⚙️ Configuración de APIs
          </Link>
        </footer>
      </div>
    </main>
  );
}

function EditorCard({
  href,
  emoji,
  title,
  description,
  bullets,
  accent,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  bullets: string[];
  accent: 'pink' | 'yellow';
}) {
  const ring =
    accent === 'pink'
      ? 'hover:border-brand-pink hover:shadow-[0_8px_30px_rgba(255,45,138,0.15)]'
      : 'hover:border-yellow-400 hover:shadow-[0_8px_30px_rgba(255,244,102,0.35)]';
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm transition ${ring}`}
    >
      <span
        className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl text-3xl ${
          accent === 'pink' ? 'bg-brand-pink/10' : 'bg-brand-yellow/40'
        }`}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2 text-xs text-neutral-600">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                accent === 'pink' ? 'bg-brand-pink' : 'bg-yellow-400'
              }`}
            />
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink">
        Abrir editor
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
