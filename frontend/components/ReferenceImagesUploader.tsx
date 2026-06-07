'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { REFERENCE_LIMITS } from '@/lib/generation-settings';
import {
  SUPPORTED_IMAGE_MIMES,
  makeImageId,
  resizeImageToDataUrl,
} from '@/lib/image-upload';

export interface ReferenceImage {
  /** id estable cliente, para keys de React */
  id: string;
  /** data: URL listo para mandar al backend */
  dataUrl: string;
  /** nombre original */
  name: string;
  /** tamaño del payload tras resize (bytes) */
  bytes: number;
  /** ancho y alto tras resize */
  width: number;
  height: number;
}

interface ReferenceImagesUploaderProps {
  value: ReferenceImage[];
  onChange: (next: ReferenceImage[]) => void;
  disabled?: boolean;
  max?: number;
}

const SUPPORTED_MIMES: readonly string[] = SUPPORTED_IMAGE_MIMES;

export default function ReferenceImagesUploader({
  value,
  onChange,
  disabled = false,
  max = REFERENCE_LIMITS.max,
}: ReferenceImagesUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const remainingSlots = Math.max(max - value.length, 0);
  const totalBytes = value.reduce((acc, r) => acc + r.bytes, 0);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      setError(null);
      const arr = Array.from(files);

      const valid: File[] = [];
      let skipped = 0;
      for (const f of arr) {
        if (!SUPPORTED_MIMES.includes(f.type)) {
          skipped++;
          continue;
        }
        if (f.size > REFERENCE_LIMITS.maxBytes) {
          skipped++;
          continue;
        }
        valid.push(f);
      }

      const toProcess = valid.slice(0, remainingSlots);
      const overflow = valid.length - toProcess.length;
      if (toProcess.length === 0) {
        if (skipped > 0) {
          setError(
            `Archivos descartados: ${skipped} (formato no soportado o > ${
              REFERENCE_LIMITS.maxBytes / (1024 * 1024)
            }MB)`
          );
        } else if (overflow > 0) {
          setError(`Máximo ${max} referencias. ${overflow} ignoradas.`);
        }
        return;
      }

      setProcessing(toProcess.length);

      const next: ReferenceImage[] = [...value];
      try {
        for (const f of toProcess) {
          try {
            const { dataUrl, bytes, width, height } = await resizeImageToDataUrl(
              f,
              REFERENCE_LIMITS.maxSidePx
            );
            next.push({
              id: makeImageId('ref'),
              dataUrl,
              name: f.name,
              bytes,
              width,
              height,
            });
          } catch (err) {
            console.warn('[refs] no se pudo procesar', f.name, err);
            skipped++;
          }
        }
        onChange(next);
      } finally {
        setProcessing(0);
      }

      const messages: string[] = [];
      if (skipped > 0) messages.push(`${skipped} archivo(s) descartado(s)`);
      if (overflow > 0) messages.push(`${overflow} ignorada(s) por límite`);
      setError(messages.length ? messages.join(' · ') : null);
    },
    [disabled, max, onChange, remainingSlots, value]
  );

  function handleSelectClick() {
    fileInputRef.current?.click();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFiles(files);
  }

  function removeAt(id: string) {
    onChange(value.filter((r) => r.id !== id));
  }

  function move(id: string, delta: -1 | 1) {
    const idx = value.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  function clearAll() {
    onChange([]);
  }

  const busy = disabled || processing > 0;

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-5 text-center transition ${
          dragOver
            ? 'border-brand-pink bg-pink-50/60'
            : 'border-neutral-300 bg-neutral-50/40 hover:border-brand-pink'
        } ${busy ? 'opacity-60' : ''}`}
      >
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleInputChange}
          disabled={busy}
          className="sr-only"
        />

        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mb-2 text-brand-pink"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        <p className="text-sm font-semibold text-neutral-800">
          Arrastra tus referencias o{' '}
          <button
            type="button"
            onClick={handleSelectClick}
            disabled={busy}
            className="text-brand-pink underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-pink"
          >
            selecciónalas
          </button>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Frente, perfil, cuerpo, expresiones, ropa. Cuantas más usables, mejor consistencia.
        </p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Hasta {max} imágenes · JPG/PNG/WEBP · máx{' '}
          {Math.round(REFERENCE_LIMITS.maxBytes / (1024 * 1024))}MB c/u
        </p>

        {processing > 0 && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-pink" />
            Procesando {processing}…
          </p>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-600">{error}</p>
      )}

      {value.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {value.length} de {max} · {formatBytes(totalBytes)}
              {value.length >= REFERENCE_LIMITS.recommended ? (
                <span className="ml-2 text-emerald-700">· set sólido</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="text-[11px] font-semibold text-neutral-500 underline-offset-2 hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Quitar todas
            </button>
          </div>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {value.map((ref, idx) => (
              <li
                key={ref.id}
                className="group relative overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
              >
                <div
                  className="w-full overflow-hidden bg-neutral-100"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.dataUrl}
                    alt={ref.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <span className="absolute left-1 top-1 inline-flex items-center rounded-full bg-brand-pink px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  #{idx + 1}
                </span>

                <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => removeAt(ref.id)}
                    disabled={busy}
                    aria-label={`Quitar referencia ${idx + 1}`}
                    title="Quitar"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-red-600 shadow hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-brand-pink"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => move(ref.id, -1)}
                    disabled={busy || idx === 0}
                    aria-label="Mover referencia hacia arriba en el orden"
                    title="Mover antes"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <span className="truncate text-[10px] text-neutral-500" title={ref.name}>
                    {ref.width}×{ref.height}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(ref.id, 1)}
                    disabled={busy || idx === value.length - 1}
                    aria-label="Mover referencia hacia abajo en el orden"
                    title="Mover después"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
