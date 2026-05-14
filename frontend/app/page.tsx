'use client';

import { useState } from 'react';
import PromptForm from '@/components/PromptForm';
import ProjectHeader from '@/components/ProjectHeader';
import ScenesGrid from '@/components/ScenesGrid';
import SceneDetailPanel from '@/components/SceneDetailPanel';
import TimelineStrip from '@/components/TimelineStrip';
import type { GenerateStoryResponse, Scene } from '@/types/story';

export default function Home() {
  const [result, setResult] = useState<GenerateStoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  const hasResult = result !== null;

  function handleReset() {
    setResult(null);
    setSelectedScene(null);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8 pb-40">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Contenido <span className="text-brand-pink">TIAAT</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Fase 5 — Timeline UI
          </p>
        </header>

        {!hasResult && !loading && (
          <EmptyState>
            <PromptForm onResult={setResult} onLoadingChange={setLoading} />
          </EmptyState>
        )}

        {loading && (
          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <PromptForm onResult={setResult} onLoadingChange={setLoading} />
            </div>
            <LoadingState />
          </div>
        )}

        {hasResult && !loading && result && (
          <div className="space-y-6">
            <ProjectHeader project={result} onReset={handleReset} />

            <details className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
                Generar otra historia
              </summary>
              <div className="mt-4">
                <PromptForm onResult={setResult} onLoadingChange={setLoading} />
              </div>
            </details>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Escenas
              </h2>
              <ScenesGrid
                scenes={result.scenes}
                selectedSceneNumber={selectedScene?.scene_number ?? null}
                onSelectScene={setSelectedScene}
              />
            </section>
          </div>
        )}
      </div>

      {hasResult && !loading && result && (
        <div className="fixed bottom-0 left-0 right-0 z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <TimelineStrip
            scenes={result.scenes}
            selectedSceneNumber={selectedScene?.scene_number ?? null}
            onSelectScene={setSelectedScene}
          />
        </div>
      )}

      <SceneDetailPanel scene={selectedScene} onClose={() => setSelectedScene(null)} />
    </main>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          Genera tu primera historia visual
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Describe la escena, elige el modelo y deja que el pipeline arme el storyboard.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-600">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-pink" />
        Generando escenas e imágenes…
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            <div
              className="w-full animate-pulse bg-neutral-200"
              style={{ aspectRatio: '9 / 16' }}
            />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
