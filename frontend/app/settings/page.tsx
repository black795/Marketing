import Link from 'next/link';
import CaptionProviderPanel from '@/components/settings/CaptionProviderPanel';

/**
 * ⚙️ Configuración de APIs.
 *
 * Sección de ajustes del sistema. Hoy contiene la integración de Captions;
 * está pensada para crecer (otros proveedores, claves, webhooks) sin tocar
 * los flujos de generación existentes.
 */
export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-brand-pink"
          >
            ← Volver al inicio
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            ⚙️ Configuración de <span className="text-brand-pink">APIs</span>
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Conecta y prueba los servicios externos del sistema.
          </p>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <header className="mb-5 flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-pink/10 text-lg"
              aria-hidden="true"
            >
              🎙️
            </span>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Caption Provider
              </h2>
              <p className="text-xs text-neutral-500">
                Proveedor de subtítulos automáticos para el editor de captions.
              </p>
            </div>
          </header>
          <CaptionProviderPanel />
        </section>

        <p className="mt-6 text-center text-[11px] text-neutral-400">
          Las API keys se guardan solo en el backend (archivo protegido, fuera
          del control de versiones) y nunca se exponen al navegador.
        </p>
      </div>
    </main>
  );
}
