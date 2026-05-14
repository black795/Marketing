'use client';

import { useEffect } from 'react';
import type { Scene } from '@/types/story';

interface SceneDetailPanelProps {
  scene: Scene | null;
  onClose: () => void;
}

export default function SceneDetailPanel({ scene, onClose }: SceneDetailPanelProps) {
  const open = scene !== null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={scene ? `Detalle de la escena ${scene.scene_number}` : 'Detalle de escena'}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {scene && (
          <>
            <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-brand-pink px-2.5 py-1 text-xs font-bold text-white">
                  #{scene.scene_number}
                </span>
                <h2 className="text-base font-semibold text-neutral-900">
                  {scene.scene_title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar panel de detalle"
                className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div
                className="relative mb-5 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
                style={{ aspectRatio: '9 / 16', maxHeight: '420px' }}
              >
                {scene.image_url ? (
                  <img
                    src={scene.image_url}
                    alt={scene.scene_title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-neutral-500">
                    Imagen no generada
                    {scene.image_error ? (
                      <span className="mt-1 block text-xs text-neutral-400">
                        {scene.image_error}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <section className="mb-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Narration
                </h3>
                <p className="rounded-md border-l-4 border-brand-pink bg-pink-50/40 px-4 py-3 text-sm leading-relaxed text-neutral-800">
                  {scene.narration}
                </p>
              </section>

              <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <DetailBlock label="Camera" value={scene.camera} />
                <DetailBlock label="Lighting" value={scene.lighting} />
                <DetailBlock label="Emotion" value={scene.emotion} />
              </section>

              <section className="mb-2">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Image prompt
                </h3>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-800">
                  {scene.image_prompt}
                </pre>
              </section>

              <section className="text-xs text-neutral-500">
                Duración: <span className="font-semibold text-neutral-800">{scene.duration}s</span>
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="text-sm text-neutral-800">{value}</p>
    </div>
  );
}
