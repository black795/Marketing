'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { AVATAR_IMAGE_LIMITS, formatBytes } from '@/lib/avatar';
import { dlog, dwarn } from '@/lib/debug-log';

/** Una imagen candidata de avatar, ya redimensionada en el cliente. */
export interface AvatarImage {
  id: string;
  dataUrl: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
}

interface AvatarImageDropzoneProps {
  /** Galería de candidatas subidas. */
  candidates: AvatarImage[];
  /** id de la candidata activa (la que se mandará a la API). */
  selectedId: string | null;
  onChangeCandidates: (next: AvatarImage[]) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `avatar-img-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`No se pudo leer ${file.name}`));
    };
    img.src = url;
  });
}

/** Redimensiona la imagen al lado máximo permitido y devuelve un data: URL. */
async function resizeToDataUrl(
  file: File,
  maxSide: number
): Promise<{ dataUrl: string; bytes: number; width: number; height: number }> {
  const img = await loadImage(file);
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.drawImage(img, 0, 0, w, h);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(mime, mime === 'image/png' ? undefined : 0.92);
  const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
  const bytes = Math.floor((base64Len * 3) / 4);
  return { dataUrl, bytes, width: w, height: h };
}

/**
 * Uploader de la imagen del avatar. La API usa UNA sola imagen, así que
 * permite mantener varias candidatas y elegir la activa con un clic
 * (sensación de galería sin romper el contrato de la API).
 */
export default function AvatarImageDropzone({
  candidates,
  selectedId,
  onChangeCandidates,
  onSelect,
  disabled = false,
}: AvatarImageDropzoneProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const remainingSlots = Math.max(
    AVATAR_IMAGE_LIMITS.maxCandidates - candidates.length,
    0
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      setError(null);
      const arr = Array.from(files);

      const valid: File[] = [];
      let skipped = 0;
      for (const f of arr) {
        if (!AVATAR_IMAGE_LIMITS.supportedMimes.includes(f.type)) {
          skipped++;
          continue;
        }
        if (f.size > AVATAR_IMAGE_LIMITS.maxBytes) {
          skipped++;
          continue;
        }
        valid.push(f);
      }

      const toProcess = valid.slice(0, remainingSlots);
      if (toProcess.length === 0) {
        if (skipped > 0) {
          setError(
            `Archivos descartados: ${skipped} (formato no soportado o > ${formatBytes(
              AVATAR_IMAGE_LIMITS.maxBytes
            )}).`
          );
        } else if (remainingSlots === 0) {
          setError(`Máximo ${AVATAR_IMAGE_LIMITS.maxCandidates} imágenes.`);
        }
        return;
      }

      setProcessing(toProcess.length);
      const next: AvatarImage[] = [...candidates];
      let firstNewId: string | null = null;
      try {
        for (const f of toProcess) {
          try {
            const { dataUrl, bytes, width, height } = await resizeToDataUrl(
              f,
              AVATAR_IMAGE_LIMITS.maxSidePx
            );
            const id = makeId();
            if (!firstNewId) firstNewId = id;
            next.push({ id, dataUrl, name: f.name, bytes, width, height });
            dlog('avatar-upload', 'imagen procesada', {
              name: f.name,
              bytes,
              dims: `${width}x${height}`,
            });
          } catch (err) {
            dwarn('avatar-upload', `no se pudo procesar ${f.name}`, err);
            skipped++;
          }
        }
        onChangeCandidates(next);
        // Auto-selecciona la primera imagen subida si no había ninguna activa.
        if (!selectedId && firstNewId) onSelect(firstNewId);
      } finally {
        setProcessing(0);
      }

      if (skipped > 0) setError(`${skipped} archivo(s) descartado(s).`);
    },
    [candidates, disabled, onChangeCandidates, onSelect, remainingSlots, selectedId]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }

  function removeAt(id: string) {
    const next = candidates.filter((c) => c.id !== id);
    onChangeCandidates(next);
    if (selectedId === id) {
      // Si quitamos la activa, pasamos la selección a la primera que quede.
      onSelect(next[0]?.id ?? '');
      dlog('avatar-upload', 'imagen activa eliminada — reasignando selección');
    }
  }

  const busy = disabled || processing > 0;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? 'border-brand-pink bg-pink-50/60'
            : 'border-neutral-300 bg-neutral-50/50 hover:border-brand-pink'
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
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
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
          Arrastra el retrato del avatar o{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="text-brand-pink underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-pink"
          >
            selecciónalo
          </button>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Retrato nítido, cara visible y bien iluminada. Mejor resultado con
          fondo simple.
        </p>
        <p className="mt-1 text-[11px] text-neutral-400">
          JPG/PNG/WEBP · máx {formatBytes(AVATAR_IMAGE_LIMITS.maxBytes)} · hasta{' '}
          {AVATAR_IMAGE_LIMITS.maxCandidates} candidatas
        </p>
        {processing > 0 && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-pink" />
            Procesando {processing}…
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

      {candidates.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-neutral-500">
            {candidates.length === 1
              ? 'Imagen lista.'
              : `${candidates.length} candidatas — toca una para usarla como avatar.`}
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((img) => {
              const active = img.id === selectedId;
              return (
                <li key={img.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(img.id)}
                    disabled={busy}
                    aria-pressed={active}
                    aria-label={`Usar ${img.name} como avatar`}
                    className={`group block w-full overflow-hidden rounded-md border-2 bg-neutral-100 transition ${
                      active
                        ? 'border-brand-pink ring-2 ring-brand-pink/30'
                        : 'border-transparent hover:border-neutral-300'
                    }`}
                    style={{ aspectRatio: '1 / 1' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  {active && (
                    <span className="absolute left-1 top-1 inline-flex items-center rounded-full bg-brand-pink px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                      Avatar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(img.id)}
                    disabled={busy}
                    aria-label={`Quitar ${img.name}`}
                    title="Quitar"
                    className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 shadow hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-brand-pink"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
