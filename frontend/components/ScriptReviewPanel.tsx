'use client';

import { useState } from 'react';
import type { GenerateScriptResponse, Scene } from '@/types/story';
import type { GenerationSettings } from '@/lib/generation-settings';
import GenerationSettingsControls from './GenerationSettingsControls';

interface ScriptReviewPanelProps {
  script: GenerateScriptResponse;
  approved: boolean;
  regenerating: boolean;
  generatingImages: boolean;
  error?: string | null;
  settings: GenerationSettings;
  onSettingsChange: (next: GenerationSettings) => void;
  onChange: (next: GenerateScriptResponse) => void;
  onApprove: () => void;
  onUnapprove: () => void;
  onRegenerate: () => void;
  onContinue: () => void;
}

export default function ScriptReviewPanel({
  script,
  approved,
  regenerating,
  generatingImages,
  error,
  settings,
  onSettingsChange,
  onChange,
  onApprove,
  onUnapprove,
  onRegenerate,
  onContinue,
}: ScriptReviewPanelProps) {
  const [editing, setEditing] = useState(false);
  const busy = regenerating || generatingImages;

  function updateField<K extends keyof GenerateScriptResponse>(
    key: K,
    value: GenerateScriptResponse[K]
  ) {
    onChange({ ...script, [key]: value });
  }

  function updateScene(sceneNumber: number, patch: Partial<Scene>) {
    const next = script.scenes.map((s) =>
      s.scene_number === sceneNumber ? { ...s, ...patch } : s
    );
    onChange({ ...script, scenes: next });
  }

  function toggleEditing() {
    if (approved) onUnapprove();
    setEditing((v) => !v);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-yellow/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-pink" />
              Fase 2 — Revisión de guion
            </span>

            {editing ? (
              <input
                type="text"
                value={script.title ?? ''}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Título del proyecto"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-xl font-bold text-neutral-900 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
              />
            ) : (
              <h2 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
                {script.title || 'Proyecto sin título'}
              </h2>
            )}

            {editing ? (
              <textarea
                value={script.style ?? ''}
                onChange={(e) => updateField('style', e.target.value)}
                rows={2}
                placeholder="Estilo visual global"
                className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
              />
            ) : script.style ? (
              <p className="mt-1 text-sm text-neutral-500">{script.style}</p>
            ) : null}

            {(script.characters ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(script.characters ?? []).map((c) => (
                  <span
                    key={c.name}
                    title={c.description}
                    className="inline-flex items-center rounded-full bg-brand-yellow/40 px-3 py-1 text-xs font-semibold text-neutral-800"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
            <button
              type="button"
              onClick={toggleEditing}
              disabled={busy}
              aria-pressed={editing}
              aria-label={editing ? 'Cerrar edición del guion' : 'Editar el guion manualmente'}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50 ${
                editing
                  ? 'border-brand-pink bg-brand-pink text-white hover:bg-pink-600'
                  : 'border-neutral-300 bg-white text-neutral-800 hover:border-brand-pink hover:text-brand-pink'
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {editing ? 'Cerrar edición' : 'Editar'}
            </button>

            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              aria-label="Descartar este guion y generar uno nuevo"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-brand-pink hover:text-brand-pink focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={regenerating ? 'animate-spin' : ''}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {regenerating ? 'Regenerando…' : 'Regenerar guion'}
            </button>

            {approved ? (
              <button
                type="button"
                onClick={onUnapprove}
                disabled={busy}
                aria-label="Quitar aprobación del guion"
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
              >
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
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guion aprobado
              </button>
            ) : (
              <button
                type="button"
                onClick={onApprove}
                disabled={busy || editing}
                aria-label="Aprobar el guion"
                title={
                  editing
                    ? 'Cierra el modo edición para aprobar'
                    : 'Aprobar el guion para continuar a imágenes'
                }
                className="inline-flex items-center gap-2 rounded-md bg-brand-pink px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
              >
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
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Aprobar guion
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Escenas
          </h3>
          <p className="text-xs text-neutral-400">
            {script.scenes.length}{' '}
            {script.scenes.length === 1 ? 'escena' : 'escenas'}
            {' · '}
            {script.scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0)}s totales
          </p>
        </div>

        <ol className="space-y-3">
          {script.scenes.map((scene) => (
            <li
              key={scene.scene_number}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-pink"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-brand-pink px-2.5 py-1 text-xs font-bold text-white">
                    #{scene.scene_number}
                  </span>
                  {editing ? (
                    <input
                      type="text"
                      value={scene.scene_title}
                      onChange={(e) =>
                        updateScene(scene.scene_number, {
                          scene_title: e.target.value,
                        })
                      }
                      className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-semibold text-neutral-900 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
                    />
                  ) : (
                    <h4 className="text-sm font-semibold text-neutral-900">
                      {scene.scene_title}
                    </h4>
                  )}
                </div>
                <span className="text-xs text-neutral-500">
                  {scene.duration}s
                </span>
              </div>

              <div className="mb-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Narration
                </p>
                {editing ? (
                  <textarea
                    value={scene.narration}
                    onChange={(e) =>
                      updateScene(scene.scene_number, {
                        narration: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
                  />
                ) : (
                  <p className="rounded-md border-l-4 border-brand-pink bg-pink-50/40 px-3 py-2 text-sm leading-relaxed text-neutral-800">
                    {scene.narration}
                  </p>
                )}
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Tag label="Camera" value={scene.camera} />
                <Tag label="Lighting" value={scene.lighting} />
                <Tag label="Emotion" value={scene.emotion} />
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Image prompt
                </p>
                {editing ? (
                  <textarea
                    value={scene.image_prompt}
                    onChange={(e) =>
                      updateScene(scene.scene_number, {
                        image_prompt: e.target.value,
                      })
                    }
                    rows={4}
                    className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
                  />
                ) : (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-800">
                    {scene.image_prompt}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Configuración de imágenes
          </p>
          <p className="text-[11px] text-neutral-400">
            Aplicada a la generación inicial y a las regeneraciones.
          </p>
        </div>
        <GenerationSettingsControls
          value={settings}
          onChange={onSettingsChange}
          disabled={busy}
          variant="compact"
          hideSceneCount
        />
      </div>

      <div className="sticky bottom-0 z-20 -mx-6 border-t border-neutral-200 bg-white/95 px-6 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {approved
              ? `Guion aprobado · ${settings.quality} · ${settings.aspectRatio}. Genera las imágenes cuando estés listo.`
              : 'Aprueba el guion para habilitar la generación de imágenes.'}
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!approved || busy}
            aria-label="Continuar a la generación de imágenes"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingImages ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="animate-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generando imágenes…
              </>
            ) : (
              <>
                Continuar a imágenes
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="text-xs text-neutral-800">{value}</p>
    </div>
  );
}
