'use client';

import type { GenerateStoryResponse } from '@/types/story';
import ExportJsonButton from './ExportJsonButton';
import VideoPlaceholderButton from './VideoPlaceholderButton';

interface ProjectHeaderProps {
  project: GenerateStoryResponse;
  onReset?: () => void;
}

export default function ProjectHeader({ project, onReset }: ProjectHeaderProps) {
  const characters = project.characters ?? [];

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
              aria-label="Generar una nueva historia"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink"
            >
              Nueva
            </button>
          )}
          <ExportJsonButton project={project} />
          <VideoPlaceholderButton />
        </div>
      </div>
    </header>
  );
}
