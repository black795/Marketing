'use client';

import { useRef, useState } from 'react';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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
              <h3 className="text-sm font-semibold text-neutral-900">Archivos seleccionados ({files.length})</h3>
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-2">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-white p-2 text-sm shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xl" aria-hidden>
                        {file.type.startsWith('image/') ? '🖼️' : '🎞️'}
                      </span>
                      <span className="truncate font-medium text-neutral-700">{file.name}</span>
                      <span className="text-xs text-neutral-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1 text-neutral-400 hover:text-red-500"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
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
