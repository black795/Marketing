'use client';

// Botón "Guardar proyecto": persiste el snapshot completo del store en el
// backend para poder retomarlo después. Si el proyecto ya fue guardado,
// sobrescribe; si no, pide un nombre.

import React, { useState } from 'react';
import { Icon } from './icons';
import { Button } from './primitives';
import { projectStore, useProject } from './project-store';
import { saveProjectSnapshot, stripProjectImages } from '@/lib/project-library';

export default function SaveProjectButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { savedProjectId, script } = useProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function persist(useName: string, id: string | null) {
    setSaving(true);
    setError(null);
    try {
      const full = projectStore.get();
      const state = includeImages ? full : stripProjectImages(full);
      const meta = await saveProjectSnapshot({ id, name: useName, state });
      projectStore.set({ savedProjectId: meta.id });
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  function onClick() {
    if (savedProjectId) {
      // Re-guardar sobre el mismo proyecto, sin pedir nombre.
      void persist(script?.title ?? 'Proyecto', savedProjectId);
    } else {
      setName(script?.title ?? '');
      setOpen(true);
    }
  }

  return (
    <>
      <Button variant="secondary" size={size} icon={Icon.Save} onClick={onClick} loading={saving}>
        {saved ? 'Guardado ✓' : savedProjectId ? 'Guardar' : 'Guardar proyecto'}
      </Button>

      {open && (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="anim-fade-up"
            style={{
              width: 'min(420px, 100%)',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-lg)',
              padding: 22,
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--fg-1)' }}>
              Guardar proyecto
            </h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void persist(name.trim(), null);
              }}
              placeholder="Nombre del proyecto"
              style={{
                width: '100%',
                background: 'var(--bg-1)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '9px 11px',
                fontSize: 14,
                color: 'var(--fg-1)',
                outline: 'none',
              }}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                fontSize: 12,
                color: 'var(--fg-2)',
                cursor: 'pointer',
              }}
              title="Si lo desmarcás, se guarda solo el guion, prompts y config — sin las imágenes (más liviano)."
            >
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
              />
              Incluir imágenes generadas
            </label>
            {error && <p style={{ fontSize: 12, color: 'var(--red-hi)', margin: '8px 0 0' }}>⚠ {error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                variant="primary"
                size="md"
                icon={Icon.Save}
                glow
                loading={saving}
                disabled={!name.trim()}
                onClick={() => void persist(name.trim(), null)}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
