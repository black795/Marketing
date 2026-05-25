'use client';

import { useSandboxStatus } from '@/lib/sandbox-api';

/**
 * Badge sticky global que muestra cuando el sandbox/mock mode está ON.
 *
 * Se monta en el RootLayout — visible en todas las páginas. Cuando el
 * usuario ve el badge sabe que:
 *   - las generaciones de imagen devuelven SVG placeholder
 *   - las generaciones de video devuelven mp4 placeholder
 *   - NO se está consumiendo cuota de Replicate
 *
 * Click → toggle off (si la fuente lo permite). Doble shortcut: link a /settings.
 */
export default function SandboxBadge() {
  const { status, toggle } = useSandboxStatus();

  if (!status || !status.enabled) return null;

  const lockedByEnv = status.source === 'env';

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-lg backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="text-base">🧪</span>
      <span className="tracking-tight">
        SANDBOX MODE
        <span className="ml-1 font-normal text-amber-700">· sin consumo IA</span>
      </span>
      {lockedByEnv ? (
        <span
          className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
          title="Forzado por SANDBOX_MODE en .env"
        >
          env
        </span>
      ) : (
        <button
          type="button"
          onClick={() => toggle(false)}
          className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 transition hover:bg-amber-300"
        >
          turn off
        </button>
      )}
    </div>
  );
}
