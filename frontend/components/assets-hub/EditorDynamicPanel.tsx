'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listCaptionTemplates } from '@/lib/captions-api';
import { getEditor } from '@/lib/editor-adapters';
import type { CaptionTemplate } from '@/types/captions';
import Spinner from '@/components/loading/Spinner';

interface EditorDynamicPanelProps {
  editorId: string;
  captionTemplateId: string | null;
  onPatch: (patch: { captionTemplateId?: string | null }) => void;
  disabled?: boolean;
}

/**
 * Panel de configuración específica del editor seleccionado.
 *
 * La UI cambia según el editor:
 *   - captions  → grid de plantillas de estilo (live desde la API).
 *   - remotion  → metadata de composición (fps/dimensiones del timeline).
 *   - otros     → tarjeta "próximamente" con lo que cubrirá esa integración.
 */
export default function EditorDynamicPanel({
  editorId,
  captionTemplateId,
  onPatch,
  disabled = false,
}: EditorDynamicPanelProps) {
  const editor = getEditor(editorId);
  if (!editor) return null;

  if (editorId === 'captions') {
    return (
      <CaptionsConfig
        captionTemplateId={captionTemplateId}
        onPatch={onPatch}
        disabled={disabled}
      />
    );
  }

  if (editorId === 'remotion') {
    return (
      <div className="space-y-2 text-sm text-neutral-700">
        <p className="font-semibold">🎬 Composición Remotion</p>
        <ul className="space-y-1 text-xs text-neutral-500">
          <li>• Salida 9:16, 1080×1920, 30fps (defaults del timeline).</li>
          <li>
            • Cada escena = una composición secuencial usando los clips del{' '}
            <code className="text-neutral-700">timeline.json</code>.
          </li>
          <li>• El editor interactivo entra en una fase posterior.</li>
        </ul>
        <p className="text-[11px] text-neutral-400">
          Al pulsar "Preparar y abrir editor" se carga el timeline en{' '}
          <code>/editor/remotion</code> listo para inspección.
        </p>
      </div>
    );
  }

  // Stubs honestos para los editores aún no implementados.
  return (
    <div className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <p className="font-semibold">
        {editor.info.emoji} {editor.info.label} — próximamente
      </p>
      <p className="mt-1 text-amber-700">{editor.info.description}</p>
      <p className="mt-2 text-[11px] text-amber-600">
        El plan de edición se guarda igual: cuando este editor se conecte,
        leerá tu prompt y tags directamente desde el{' '}
        <code>edit-plan.json</code>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel: plantillas de captions
// ---------------------------------------------------------------------------

function CaptionsConfig({
  captionTemplateId,
  onPatch,
  disabled,
}: {
  captionTemplateId: string | null;
  onPatch: (patch: { captionTemplateId?: string | null }) => void;
  disabled?: boolean;
}) {
  const [templates, setTemplates] = useState<CaptionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCaptionTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-500">
        <Spinner size={16} className="text-brand-pink" /> Cargando plantillas de
        captions…
      </p>
    );
  }
  if (error) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
        <p className="font-semibold">No se pudieron cargar las plantillas.</p>
        <p className="mt-0.5">{error}</p>
        <p className="mt-1 text-red-600">
          Revisa la API key en{' '}
          <Link href="/settings" className="font-semibold underline">
            ⚙️ Configuración de APIs
          </Link>
          . Igual puedes continuar — el editor te dejará elegir luego.
        </p>
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        El proveedor no devolvió plantillas. Continúa y elige una en el editor.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        Pre-elige el estilo de subtítulos (también podrás cambiarlo en el editor).
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {templates.map((t) => {
          const active = t.id === captionTemplateId;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPatch({ captionTemplateId: active ? null : t.id })}
                onMouseEnter={(e) =>
                  e.currentTarget.querySelector('video')?.play().catch(() => {})
                }
                onMouseLeave={(e) => {
                  const v = e.currentTarget.querySelector('video');
                  if (v) {
                    v.pause();
                    v.currentTime = 0;
                  }
                }}
                className={`block w-full overflow-hidden rounded-md border-2 transition disabled:opacity-50 ${
                  active
                    ? 'border-brand-pink ring-2 ring-brand-pink/30'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
                style={{ aspectRatio: '9 / 16' }}
              >
                {t.previewUrl ? (
                  <video
                    src={t.previewUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-[10px] text-neutral-500">
                    sin preview
                  </div>
                )}
              </button>
              <p className="mt-1 truncate text-[10px] font-semibold text-neutral-600">
                {t.name}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
