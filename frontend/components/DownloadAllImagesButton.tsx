'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import type { GenerateStoryResponse } from '@/types/story';

interface DownloadAllImagesButtonProps {
  project: GenerateStoryResponse;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'project'
  );
}

function extensionFromUrl(url: string): string {
  const clean = url.split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return 'jpg';
  const ext = clean.slice(dot + 1).toLowerCase();
  if (ext.length < 2 || ext.length > 5) return 'jpg';
  return ext;
}

export default function DownloadAllImagesButton({
  project,
}: DownloadAllImagesButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenesWithImage = project.scenes
    .filter((s) => !!s.image_url)
    .sort((a, b) => a.scene_number - b.scene_number);
  const total = scenesWithImage.length;
  const disabled = busy || total === 0;

  async function handleClick() {
    if (disabled) return;

    setBusy(true);
    setError(null);

    const baseName = slugify(project.title ?? project.projectId ?? 'project');

    try {
      const zip = new JSZip();
      const folder = zip.folder(baseName) ?? zip;

      for (const scene of scenesWithImage) {
        const url = scene.image_url as string;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Escena ${scene.scene_number}: HTTP ${response.status}`
          );
        }
        const blob = await response.blob();
        const ext = extensionFromUrl(url);
        const safeTitle = slugify(
          scene.scene_title || `scene-${scene.scene_number}`
        );
        const fileName = `${String(scene.scene_number).padStart(
          2,
          '0'
        )}-${safeTitle}.${ext}`;
        folder.file(fileName, blob);
      }

      const manifest = {
        projectId: project.projectId,
        title: project.title ?? null,
        style: project.style ?? null,
        model: project.model,
        characters: project.characters ?? [],
        scenes: scenesWithImage.map((s) => ({
          scene_number: s.scene_number,
          scene_title: s.scene_title,
          narration: s.narration,
          image_prompt: s.image_prompt,
          duration: s.duration,
        })),
      };
      folder.file('manifest.json', JSON.stringify(manifest, null, 2));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const objectUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${baseName}-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (err) {
      console.warn('[download-all] falló:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo armar el ZIP de imágenes'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={`Descargar todas las imágenes en un archivo ZIP (${total})`}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-brand-pink hover:text-brand-pink focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-300 disabled:hover:text-neutral-800"
      >
        {busy ? (
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
        ) : (
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        {busy ? 'Armando ZIP…' : `Descargar imágenes (${total})`}
      </button>
      {error && (
        <p className="mt-1 max-w-[220px] text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
