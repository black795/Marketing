'use client';

import { useState } from 'react';
import { EDITOR_PRESETS, type EditorPreset } from '@/lib/editor-presets';

interface EditConfigPanelProps {
  presetId: string | null;
  prompt: string;
  tags: string[];
  disabled?: boolean;
  /** Patch parcial — el padre maneja autosave. */
  onPatch: (patch: {
    presetId?: string | null;
    prompt?: string;
    tags?: string[];
    /** Cuando se aplica un preset, sugiere también este editor. */
    suggestedEditor?: 'remotion' | 'captions';
  }) => void;
}

/**
 * Configuración de cómo se va a editar el contenido: preset de estilo,
 * prompt libre y tags. Al elegir un preset, siembra el prompt (si está
 * vacío), mezcla los tags y propone su editor sugerido (sin imponerlo).
 */
export default function EditConfigPanel({
  presetId,
  prompt,
  tags,
  disabled = false,
  onPatch,
}: EditConfigPanelProps) {
  const [tagInput, setTagInput] = useState('');

  function applyPreset(p: EditorPreset) {
    const mergedTags = Array.from(new Set([...tags, ...p.tags]));
    onPatch({
      presetId: p.id,
      // Sembrar prompt SOLO si está vacío — respeta lo que el usuario tipeó.
      ...(prompt.trim().length === 0 ? { prompt: p.promptSeed } : {}),
      tags: mergedTags,
      suggestedEditor: p.suggestedEditor,
    });
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t)) {
      setTagInput('');
      return;
    }
    onPatch({ tags: [...tags, t] });
    setTagInput('');
  }

  function removeTag(t: string) {
    onPatch({ tags: tags.filter((x) => x !== t) });
  }

  return (
    <div className="space-y-5">
      {/* Presets */}
      <section>
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Preset de estilo
          </h3>
          {presetId && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPatch({ presetId: null })}
              className="text-[11px] font-semibold text-neutral-500 hover:text-brand-pink disabled:opacity-50"
            >
              Limpiar
            </button>
          )}
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EDITOR_PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPreset(p)}
                title={p.description}
                className={`group flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition disabled:opacity-50 ${
                  active
                    ? 'border-brand-pink bg-brand-pink/5'
                    : 'border-neutral-200 bg-white hover:border-brand-pink/60'
                }`}
              >
                <span className="text-lg" aria-hidden="true">
                  {p.emoji}
                </span>
                <span
                  className={`text-xs font-bold ${
                    active ? 'text-brand-pink' : 'text-neutral-800'
                  }`}
                >
                  {p.label}
                </span>
                <span className="line-clamp-2 text-[10px] leading-snug text-neutral-500">
                  {p.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Prompt de edición */}
      <section>
        <header className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="edit-prompt"
            className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Prompt de edición
          </label>
          <span className="text-[11px] tabular-nums text-neutral-400">
            {prompt.length} caracteres
          </span>
        </header>
        <textarea
          id="edit-prompt"
          value={prompt}
          onChange={(e) => onPatch({ prompt: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder="Describe cómo quieres que se edite el contenido: ritmo, transiciones, subtítulos, zooms, motion graphics…"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
        />
        <p className="mt-1 text-[11px] text-neutral-400">
          Los editores que soporten guion de edición leerán este prompt
          desde el `edit-plan.json` del proyecto.
        </p>
      </section>

      {/* Tags */}
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Tags
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-brand-yellow/40 px-2.5 py-1 text-[11px] font-semibold text-neutral-800"
            >
              #{t}
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeTag(t)}
                aria-label={`Quitar tag ${t}`}
                className="text-neutral-500 hover:text-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            disabled={disabled}
            placeholder={tags.length ? 'añadir…' : 'fast, viral, karaoke…'}
            className="min-w-[8rem] flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
          />
        </div>
      </section>
    </div>
  );
}
