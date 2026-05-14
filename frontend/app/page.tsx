'use client';

import { useState } from 'react';
import PromptForm from '@/components/PromptForm';
import ResponsePreview from '@/components/ResponsePreview';
import type { GenerateStoryResponse } from '@/types/story';

export default function Home() {
  const [result, setResult] = useState<GenerateStoryResponse | null>(null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Contenido <span className="text-brand-pink">TIAAT</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Fase 2 — Frontend ↔ Backend handshake
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Nueva historia</h2>
          <PromptForm onResult={setResult} />
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Respuesta del backend</h2>
          <ResponsePreview data={result} />
        </section>
      </div>
    </main>
  );
}
