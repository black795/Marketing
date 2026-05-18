'use client';

import { useEffect, useRef, useState } from 'react';
import { generateScript } from '@/lib/api';
import {
  DEFAULT_SETTINGS,
  type GenerationSettings,
} from '@/lib/generation-settings';
import type { GenerateScriptResponse } from '@/types/story';
import GenerationSettingsControls from './GenerationSettingsControls';
import ReferenceImagesUploader, {
  type ReferenceImage,
} from './ReferenceImagesUploader';
import LoadingButton from './loading/LoadingButton';
import ProgressBar from './loading/ProgressBar';

const MODEL_OPTIONS = [
  { value: 'nano-banana-pro', label: 'Nano Banana Pro' },
  { value: 'nano-banana-2', label: 'Nano Banana 2' },
  { value: 'chatgpt-image-2', label: 'ChatGPT Image 2' },
];

interface PromptFormProps {
  onScript: (data: GenerateScriptResponse, ctx: PromptContext) => void;
  onLoadingChange?: (loading: boolean) => void;
  initialVisualPrompt?: string;
  initialNarrativePrompt?: string;
  initialModel?: string;
  initialSettings?: GenerationSettings;
  initialReferences?: ReferenceImage[];
  submitLabel?: string;
  loadingLabel?: string;
}

export interface PromptContext {
  visualPrompt: string;
  narrativePrompt: string;
  model: string;
  /** Lista de referencias del personaje (data URLs ya redimensionadas). */
  referenceImages: ReferenceImage[];
  settings: GenerationSettings;
}

export default function PromptForm({
  onScript,
  onLoadingChange,
  initialVisualPrompt = '',
  initialNarrativePrompt = '',
  initialModel,
  initialSettings,
  initialReferences,
  submitLabel = 'Generar guion',
  loadingLabel = 'Generando guion…',
}: PromptFormProps) {
  const [visualPrompt, setVisualPrompt] = useState(initialVisualPrompt);
  const [narrativePrompt, setNarrativePrompt] = useState(initialNarrativePrompt);
  const [model, setModel] = useState(initialModel ?? MODEL_OPTIONS[0].value);
  const [references, setReferences] = useState<ReferenceImage[]>(
    initialReferences ?? []
  );
  const [settings, setSettings] = useState<GenerationSettings>(
    initialSettings ?? DEFAULT_SETTINGS
  );
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) {
      setStatusMessage('');
      return;
    }
    const messages = [
      'Analizando prompts…',
      'Modelando personajes…',
      'Estructurando escenas…',
      'Aplicando dirección visual…',
      'Casi listo…',
    ];
    let i = 0;
    setStatusMessage(messages[0]);
    const id = setInterval(() => {
      i = Math.min(i + 1, messages.length - 1);
      setStatusMessage(messages[i]);
    }, 2500);
    return () => clearInterval(id);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // bloquea duplicados
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const refDataUrls = references.map((r) => r.dataUrl);

      const data = await generateScript(
        {
          visualPrompt,
          narrativePrompt: narrativePrompt || undefined,
          model,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
          sceneCount: settings.sceneCount,
        },
        { signal: abort.signal }
      );

      onScript(data, {
        visualPrompt,
        narrativePrompt,
        model,
        referenceImages: references,
        settings,
      });
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        setError('Cancelado.');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-[10px] font-bold text-white">
            A
          </span>
          Prompt visual <span className="text-brand-pink">*</span>
        </label>
        <p className="mb-1.5 text-xs text-neutral-500">
          Estilo, personajes, escenas, estética, composición, ambiente, referencias visuales.
        </p>
        <textarea
          value={visualPrompt}
          onChange={(e) => setVisualPrompt(e.target.value)}
          required
          rows={4}
          placeholder="Ej: editorial bright, mujer joven con outfit oversized en estudio de cerámica, luz natural lateral, paleta pastel, textura iPhone candid…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div>
        <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-yellow text-[10px] font-bold text-neutral-900">
            B
          </span>
          Prompt narrativo
        </label>
        <p className="mb-1.5 text-xs text-neutral-500">
          Historia, tono, secuencia, emociones, mensaje, estructura.
        </p>
        <textarea
          value={narrativePrompt}
          onChange={(e) => setNarrativePrompt(e.target.value)}
          rows={4}
          placeholder="Ej: arco de inseguridad → flow → orgullo. La protagonista llega frustrada, encuentra ritmo trabajando el barro, termina sosteniendo la pieza terminada con calma…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Configuración de generación
        </p>
        <GenerationSettingsControls
          value={settings}
          onChange={setSettings}
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-neutral-700">
          Modelo de imagen
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
        <label className="mb-1 block text-sm font-semibold text-neutral-700">
          Referencias del personaje
        </label>
        <p className="mb-1.5 text-xs text-neutral-500">
          Sube varias tomas (frente, perfil, cuerpo entero, expresiones, ropa).
          El modelo las usa como identidad canónica para mantener al personaje
          consistente entre escenas y regeneraciones.
        </p>
        <ReferenceImagesUploader
          value={references}
          onChange={setReferences}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <LoadingButton
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            loadingLabel={loadingLabel}
          >
            {submitLabel}
          </LoadingButton>
          {loading && (
            <LoadingButton
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              Cancelar
            </LoadingButton>
          )}
        </div>
        {loading && (
          <ProgressBar
            value={null}
            showPercent={false}
            label={statusMessage || loadingLabel}
          />
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
