'use client';

import { useState } from 'react';
import { generateStory } from '@/lib/api';
import type { GenerateStoryResponse } from '@/types/story';

const MODEL_OPTIONS = [
  { value: 'nano-banana-pro', label: 'Nano Banana Pro' },
  { value: 'nano-banana-2', label: 'Nano Banana 2' },
  { value: 'chatgpt-image-2', label: 'ChatGPT Image 2' },
];

interface PromptFormProps {
  onResult: (data: GenerateStoryResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function PromptForm({ onResult, onLoadingChange }: PromptFormProps) {
  const [prompt, setPrompt] = useState('');
  const [storyGuide, setStoryGuide] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);

    try {
      const referenceImage = referenceFile
        ? await fileToBase64(referenceFile)
        : undefined;

      const data = await generateStory({
        prompt,
        storyGuide: storyGuide || undefined,
        model,
        referenceImage,
      });

      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-1">
          Prompt <span className="text-brand-pink">*</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={4}
          placeholder="Describe la historia que quieres generar..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-1">
          Story guide
        </label>
        <textarea
          value={storyGuide}
          onChange={(e) => setStoryGuide(e.target.value)}
          rows={3}
          placeholder="Tono, referencias visuales, audiencia (opcional)..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-1">
          Modelo
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-1">
          Imagen referencial
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-pink file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-pink-600"
        />
        {referenceFile && (
          <p className="mt-1 text-xs text-neutral-500">
            {referenceFile.name} ({Math.round(referenceFile.size / 1024)} KB)
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Generando...' : 'Generar historia'}
      </button>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
