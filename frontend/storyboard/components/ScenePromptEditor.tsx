'use client';

import { useState, useEffect, useRef } from 'react';
import type { Scene } from '@/editing';
import { useStoryboard } from '../store/context';
import { QUICK_PROMPTS, applyQuickPrompt } from '../utils/prompts';

interface Props {
  scene: Scene;
}

/**
 * Editor de prompt creativo de la escena seleccionada.
 *
 * Textarea con debounced commit al store + chips de quick-prompts ("más
 * dinámico", "más zoom", …) que se anexan al texto actual. Cada chip
 * también bumpea el `renderState` a `stale` (vía UPDATE_SCENE) para que la
 * UI marque que el render previo quedó desactualizado.
 */
export default function ScenePromptEditor({ scene }: Props) {
  const { dispatch } = useStoryboard();
  const [draft, setDraft] = useState(scene.prompt);
  const lastSceneId = useRef(scene.id);

  // Reset draft cuando cambia la escena seleccionada.
  useEffect(() => {
    if (lastSceneId.current !== scene.id) {
      lastSceneId.current = scene.id;
      setDraft(scene.prompt);
    }
  }, [scene.id, scene.prompt]);

  // Debounce de 400ms para no spamear acciones.
  useEffect(() => {
    if (draft === scene.prompt) return;
    const h = window.setTimeout(() => {
      dispatch({ type: 'SET_SCENE_PROMPT', sceneId: scene.id, prompt: draft });
    }, 400);
    return () => window.clearTimeout(h);
  }, [draft, scene.prompt, scene.id, dispatch]);

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`scene-prompt-${scene.id}`}
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
        >
          Prompt creativo de la escena
        </label>
        <textarea
          id={`scene-prompt-${scene.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Describe cómo quieres editarla — la IA generará una variante de esta escena."
          className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Quick prompts
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => setDraft((cur) => applyQuickPrompt(cur, qp))}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-brand-pink hover:text-brand-pink"
              title={qp.inject}
            >
              <span>{qp.emoji}</span>
              <span>{qp.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
