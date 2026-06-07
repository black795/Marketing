'use client';

// Botón "Guardar en favoritos" reutilizable (Revisión y Storyboard).
// Guarda el guion actual en la biblioteca de favoritos. Si hay imágenes de
// escenas generadas, ofrece un check para incluirlas (o guardar solo el texto,
// más liviano).

import React, { useState } from 'react';
import { Icon } from './icons';
import { Button } from './primitives';
import { useProject } from './project-store';
import { createFavoriteScript } from '@/lib/script-library';

export default function SaveFavoriteButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { script, scenes, form } = useProject();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);

  if (!script) return null;

  const images = (scenes ?? [])
    .map((s) => s.image_url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  async function save() {
    if (!script || saving) return;
    setSaving(true);
    const summary = [
      script.style ? `Estilo: ${script.style}` : '',
      script.scenes
        .map((s) => s.narration)
        .filter(Boolean)
        .join(' ')
        .slice(0, 1200),
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await createFavoriteScript({
        title: script.title,
        style: script.style,
        summary,
        sourcePrompt: form.visualPrompt,
        sceneCount: script.scenes.length,
        images: includeImages && images.length > 0 ? images : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* no bloquea el flujo */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Button
        variant="secondary"
        size={size}
        icon={Icon.Star}
        onClick={save}
        loading={saving}
        title="Guardar este guion en tu biblioteca de favoritos (reutilizable en cualquier proyecto)"
      >
        {saved ? 'En favoritos ✓' : 'Guardar en favoritos'}
      </Button>
      {images.length > 0 && (
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--fg-3)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            paddingLeft: 2,
          }}
          title="Si lo desmarcás, se guarda solo el texto del guion (más liviano)."
        >
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
          />
          Incluir {images.length} {images.length === 1 ? 'imagen' : 'imágenes'}
        </label>
      )}
    </div>
  );
}
