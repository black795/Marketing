'use client';

import { useSandboxStatus } from '@/lib/sandbox-api';

/**
 * Panel de control del Sandbox / Mock mode dentro de /settings.
 *
 * Permite encender/apagar el modo y explica qué impacta. Si el modo está
 * forzado por SANDBOX_MODE en el .env, el toggle queda deshabilitado y se
 * muestra un aviso.
 */
export default function SandboxPanel() {
  const { status, loading, error, toggle } = useSandboxStatus();

  const enabled = status?.enabled ?? false;
  const lockedByEnv = status?.source === 'env';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-900">
            Sandbox / Mock mode
          </p>
          <p className="text-xs text-neutral-500">
            Cuando está ON, las generaciones de <strong>imagen</strong> devuelven
            un SVG placeholder y las de <strong>video / avatar</strong> un mp4
            placeholder cacheado. Permite probar el pipeline completo
            (storyboard → timeline → render) sin consumir Replicate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(!enabled)}
          disabled={loading || lockedByEnv}
          aria-pressed={enabled}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
            enabled ? 'bg-amber-400' : 'bg-neutral-300'
          } ${loading || lockedByEnv ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {lockedByEnv && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          🔒 Forzado por <code>SANDBOX_MODE</code> en el .env del backend. Quitalo
          y reiniciá para poder controlar el toggle desde acá.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">
          ⚠ {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Bullet on={enabled} label="Imágenes IA → SVG placeholder" />
        <Bullet on={enabled} label="Videos IA → mp4 placeholder" />
        <Bullet on={enabled} label="Avatar (lipsync) → mp4 placeholder" />
        <Bullet on={enabled} label="Claude (texto) sigue real" inverse />
      </div>

      {status && (
        <p className="text-[10px] text-neutral-400">
          Estado: <strong className="text-neutral-600">{status.enabled ? 'ON' : 'OFF'}</strong>{' '}
          · fuente: <code>{status.source}</code>
          {status.updatedAt && ` · actualizado ${new Date(status.updatedAt).toLocaleString()}`}
        </p>
      )}
    </div>
  );
}

function Bullet({ on, label, inverse }: { on: boolean; label: string; inverse?: boolean }) {
  const active = inverse ? !on : on;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          active ? 'bg-amber-500' : 'bg-neutral-300'
        }`}
      />
      <span className={active ? 'text-neutral-700' : 'text-neutral-400'}>{label}</span>
    </div>
  );
}
