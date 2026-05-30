'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadClip } from '@/lib/clips-api';
import { buildTimeline } from '@/lib/captions-api';
import Link from 'next/link';

export default function ManualProjectPage() {
  const router = useRouter();
  const [projectId] = useState(`manual-${Date.now()}`);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<Map<File, string>>(new Map());

  const getUrl = (file: File): string => {
    let url = blobUrlsRef.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      blobUrlsRef.current.set(file, url);
    }
    return url;
  };

  // libera blobs cuando se quita un archivo
  useEffect(() => {
    const current = new Set(files);
    for (const [file, url] of blobUrlsRef.current.entries()) {
      if (!current.has(file)) {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(file);
      }
    }
  }, [files]);

  // libera todo al desmontar
  useEffect(() => {
    const map = blobUrlsRef.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: getUrl(file) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(
      (f) => f.type.startsWith('video/') || f.type.startsWith('image/'),
    );
    if (arr.length === 0) return;
    setFiles((prev) => [...prev, ...arr]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // permitir re-seleccionar el mismo archivo despues
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleStartProject = async () => {
    if (files.length === 0) {
      setError('Añade al menos un archivo para continuar.');
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const scenes = [];
      let currentProgress = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        
        // Subir archivo
        const res = await uploadClip(projectId, file);
        if (!res.success) {
          throw new Error(res.error || `Error al subir ${file.name}`);
        }

        // Construir escena
        scenes.push({
          scene_number: i + 1,
          image_url: isImage ? res.url : null,
          video_url: !isImage ? res.url : null,
          duration: 5, // Duración por defecto para imágenes y fallback para videos
        });

        currentProgress = Math.round(((i + 1) / files.length) * 100);
        setProgress(currentProgress);
      }

      setProgress(100);

      // Armar el timeline base
      await buildTimeline({
        projectId,
        title: 'Proyecto Manual',
        source: 'manual',
        respectOrder: true,
        scenes,
      });

      // Ir al editor
      router.push(`/editor?projectId=${projectId}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado al subir los archivos.');
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <Link href="/" className="mb-4 inline-block text-sm font-semibold text-neutral-500 hover:text-brand-pink">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Edición Manual
          </h1>
          <p className="mt-2 text-neutral-500">
            Sube tus propios clips de video o imágenes para armar un proyecto desde cero y editarlo en el pipeline.
          </p>
        </header>

        <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-12 text-center transition hover:border-brand-pink hover:bg-pink-50"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              className="hidden"
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
              📁
            </span>
            <p className="font-semibold text-neutral-700">Arrastra archivos aquí o haz clic para subir</p>
            <p className="mt-1 text-xs text-neutral-500">
              Soporta MP4, MOV, WebM, JPEG, PNG, WEBP (Max 100MB por archivo)
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Archivos seleccionados ({files.length})
                </h3>
                {!uploading && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs font-semibold text-neutral-500 hover:text-red-500"
                  >
                    Vaciar todo
                  </button>
                )}
              </div>
              <ul className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-3">
                {previews.map(({ file, url }, i) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <li
                      key={`${file.name}-${i}`}
                      className="group relative flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
                    >
                      <div className="relative aspect-video w-full bg-black">
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={url}
                            controls
                            muted
                            playsInline
                            preload="auto"
                            onLoadedMetadata={(e) => {
                              const v = e.currentTarget;
                              try {
                                v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
                              } catch {}
                            }}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {isImage ? 'IMG' : 'VIDEO'} · {i + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-neutral-700" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {!uploading && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() => moveFile(i, -1)}
                              disabled={i === 0}
                              className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30"
                              title="Mover arriba"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveFile(i, 1)}
                              disabled={i === files.length - 1}
                              className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30"
                              title="Mover abajo"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeFile(i)}
                              className="p-1 text-neutral-400 hover:text-red-500"
                              title="Eliminar"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-600">
                <span>Subiendo archivos y preparando proyecto...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-brand-pink transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-neutral-100">
            <button
              onClick={handleStartProject}
              disabled={uploading || files.length === 0}
              className="rounded-md bg-brand-pink px-6 py-2.5 font-bold text-white transition hover:bg-pink-600 disabled:opacity-50"
            >
              {uploading ? 'Procesando...' : 'Crear Proyecto y Editar →'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
