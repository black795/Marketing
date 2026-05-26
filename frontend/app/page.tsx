import Link from 'next/link';

/**
 * Pantalla inicial: el usuario elige el tipo de generación de contenido.
 *
 *   /avatar   → Creación de contenido por Avatar (NUEVO)
 *   /scripts  → Creación de contenido por Scripts y Referencias (flujo actual,
 *               movido aquí sin un solo cambio de lógica)
 */
export default function ModeSelectPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Tim Koda <span className="text-brand-pink">Creative OS</span>
          </h1>
          <p className="mt-3 text-base text-neutral-500">
            ¿Qué tipo de contenido deseas generar?
          </p>
        </header>

        <div className="grid flex-1 grid-cols-1 content-center gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ModeCard
            href="/avatar"
            emoji="🎭"
            title="Creación de contenido por Avatar"
            description="Da vida a un retrato: el avatar habla tu guion con voz IA o tu propio audio. Video lipsync listo para Reels."
            badge="Nuevo"
            accent="pink"
            bullets={[
              'Sube la imagen del avatar',
              'Guion de voz o audio propio',
              'Render en 720p / 1080p',
            ]}
          />
          <ModeCard
            href="/scripts"
            emoji="🧠"
            title="Creación de contenido por Scripts y Referencias"
            description="El flujo completo: guion → revisión → imágenes → video. Con referencias de personaje para mantener identidad."
            accent="yellow"
            bullets={[
              'Claude escribe el guion',
              'Imágenes por escena con Replicate',
              'Video y regeneración avanzada',
            ]}
          />
          <ModeCard
            href="/editor/manual"
            emoji="📎"
            title="Edición Manual (Clips Importados)"
            description="Arma tu video directamente a partir de tus propios clips de video o imágenes sin usar IA generativa."
            accent="pink"
            bullets={[
              'Sube tus propios videos o fotos',
              'Organiza tu timeline',
              'Aplica subtítulos dinámicos o estilos',
            ]}
          />
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
          <Link
            href="/editor"
            className="font-semibold text-neutral-500 hover:text-brand-pink"
          >
            🎬 Editores (Remotion · Captions)
          </Link>
          <Link
            href="/settings"
            className="font-semibold text-neutral-500 hover:text-brand-pink"
          >
            ⚙️ Configuración de APIs
          </Link>
        </footer>
      </div>
    </main>
  );
}

function ModeCard({
  href,
  emoji,
  title,
  description,
  bullets,
  badge,
  accent,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  bullets: string[];
  badge?: string;
  accent: 'pink' | 'yellow';
}) {
  const accentRing =
    accent === 'pink'
      ? 'hover:border-brand-pink hover:shadow-[0_8px_30px_rgba(255,45,138,0.15)]'
      : 'hover:border-yellow-400 hover:shadow-[0_8px_30px_rgba(255,244,102,0.35)]';

  return (
    <Link
      href={href}
      className={`group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm transition ${accentRing}`}
    >
      {badge && (
        <span className="absolute right-5 top-5 inline-flex items-center rounded-full bg-brand-pink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      )}

      <span
        className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl text-3xl ${
          accent === 'pink' ? 'bg-brand-pink/10' : 'bg-brand-yellow/40'
        }`}
        aria-hidden="true"
      >
        {emoji}
      </span>

      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        {description}
      </p>

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
        Empezar
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
