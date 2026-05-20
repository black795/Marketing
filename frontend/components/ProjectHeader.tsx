'use client';

import type { GenerateStoryResponse } from '@/types/story';
import ExportJsonButton from './ExportJsonButton';
import DownloadAllImagesButton from './DownloadAllImagesButton';
import ApproveContinueButton from './ApproveContinueButton';

interface ProjectHeaderProps {
  project: GenerateStoryResponse;
  selectionMode?: boolean;
  regenerating?: boolean;
  onReset?: () => void;
  onToggleSelectionMode?: () => void;
  onContinueToVideo?: () => void;
}

export default function ProjectHeader({
  project,
  selectionMode = false,
  regenerating = false,
  onReset,
  onToggleSelectionMode,
  onContinueToVideo,
}: ProjectHeaderProps) {
  const characters = project.characters ?? [];
  const hasAnyImage = project.scenes.some((s) => !!s.image_url);

  return (
    <header className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
            {project.title || 'Proyecto sin título'}
          </h2>
          {project.style ? (
            <p className="mt-1 text-sm text-neutral-500">{project.style}</p>
          ) : null}

          {characters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {characters.map((c) => (
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
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={regenerating}
              aria-label="Generar una nueva historia"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Nueva
            </button>
          )}

          {onToggleSelectionMode && (
            <button
              type="button"
              onClick={onToggleSelectionMode}
              disabled={regenerating || !hasAnyImage}
              aria-pressed={selectionMode}
              aria-label={
                selectionMode
                  ? 'Salir del modo de regeneración'
                  : 'Activar modo de regeneración para seleccionar imágenes'
              }
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50 ${
                selectionMode
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
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {selectionMode ? 'Cerrar selección' : 'Regenerar imágenes'}
            </button>
          )}

          <DownloadAllImagesButton project={project} />
          <ExportJsonButton project={project} />
          <ApproveContinueButton
            disabled={regenerating || selectionMode || !hasAnyImage}
            onContinue={onContinueToVideo}
          />
        </div>
      </div>
    </header>
  );
}
