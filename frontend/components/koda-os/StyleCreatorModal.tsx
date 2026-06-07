'use client';

// Creador de Estilos Visuales con imágenes referenciales.
//
// Se abre desde la sección "Estilo visual" (Scripts). Permite:
//   - nombre + nota del estilo
//   - subir imágenes referenciales (uploads)
//   - elegir imágenes YA GENERADAS del proyecto como ejemplos
// Guarda en la biblioteca compartida (createVisualStyle) y devuelve el estilo.

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Button } from './primitives';
import { createVisualStyle, updateVisualStyle, fetchVisualStyles } from '@/lib/visual-styles';
import { resizeImageToDataUrl, makeImageId, SUPPORTED_IMAGE_MIMES } from '@/lib/image-upload';
import type { VisualStyle } from '@/types/visual-style';

const MAX_SIDE = 1280;

interface UploadedRef {
  id: string;
  dataUrl: string;
}

export interface GeneratedExample {
  url: string;
  label?: string;
}

export default function StyleCreatorModal({
  open,
  onClose,
  onCreated,
  generatedImages = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (style: VisualStyle) => void;
  generatedImages?: GeneratedExample[];
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [targetId, setTargetId] = useState('');
  const [existing, setExisting] = useState<VisualStyle[]>([]);
  const [name, setName] = useState('');
  const [styleNote, setStyleNote] = useState('');
  const [uploads, setUploads] = useState<UploadedRef[]>([]);
  const [pickedGenerated, setPickedGenerated] = useState<Set<string>>(new Set());
  const [includeImages, setIncludeImages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetchVisualStyles().then((reg) => setExisting(reg.styles)).catch(() => {});
  }, [open]);

  if (!open) return null;

  function reset() {
    setMode('new');
    setTargetId('');
    setName('');
    setStyleNote('');
    setUploads([]);
    setPickedGenerated(new Set());
    setIncludeImages(true);
    setError(null);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).filter((f) =>
      (SUPPORTED_IMAGE_MIMES as readonly string[]).includes(f.type),
    );
    for (const file of list) {
      try {
        const { dataUrl } = await resizeImageToDataUrl(file, MAX_SIDE);
        setUploads((prev) => [...prev, { id: makeImageId('sref'), dataUrl }]);
      } catch {
        /* ignore single file */
      }
    }
  }

  function toggleGenerated(url: string) {
    setPickedGenerated((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  const refUrls = [...uploads.map((u) => u.dataUrl), ...Array.from(pickedGenerated)];
  // Para "agregar a existente" siempre se suman imágenes; el toggle de
  // texto-solo aplica solo al crear un estilo nuevo.
  const useImages = mode === 'existing' ? true : includeImages;
  const canSave =
    !saving &&
    (mode === 'existing'
      ? targetId.length > 0 && refUrls.length > 0
      : name.trim().length > 0 &&
        (useImages ? refUrls.length > 0 : styleNote.trim().length > 0));

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const refs = useImages ? refUrls.map((url) => ({ tipo: 'ejemplo' as const, url })) : [];
      const style =
        mode === 'existing'
          ? await updateVisualStyle(targetId, { addReferences: refs })
          : await createVisualStyle({
              name: name.trim(),
              styleNote: styleNote.trim() || undefined,
              references: refs,
              thumbnail: useImages ? refUrls[0] ?? null : null,
            });
      onCreated(style);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estilo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
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
          width: 'min(640px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--fg-1)' }}>
            {mode === 'new' ? 'Nuevo estilo visual' : 'Agregar a un estilo'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer' }}
          >
            <Icon.X size={18} />
          </button>
        </div>

        {/* Toggle de modo */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            background: 'var(--bg-1)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--line)',
            marginBottom: 14,
          }}
        >
          {([['new', 'Crear nuevo'], ['existing', 'Agregar a existente']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={m === 'existing' && existing.length === 0}
              style={{
                height: 30,
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                cursor: m === 'existing' && existing.length === 0 ? 'not-allowed' : 'pointer',
                opacity: m === 'existing' && existing.length === 0 ? 0.4 : 1,
                background: mode === m ? 'var(--bg-3)' : 'transparent',
                color: mode === m ? 'var(--fg-1)' : 'var(--fg-3)',
                boxShadow: mode === m ? '0 0 0 1px var(--blue-ring)' : 'none',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'new' ? (
          <>
            <label style={fieldLabel}>Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Editorial pastel, Cartoon de marca…"
              style={inputStyle}
            />
            <label style={{ ...fieldLabel, marginTop: 14 }}>Nota de estilo (opcional)</label>
            <textarea
              value={styleNote}
              onChange={(e) => setStyleNote(e.target.value)}
              rows={2}
              placeholder="Paleta, luz, textura, tono… lo que define el look."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
            />
          </>
        ) : (
          <>
            <label style={fieldLabel}>Estilo destino</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={inputStyle}>
              <option value="">Elegí un estilo…</option>
              {existing.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.references.length} refs)
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 0' }}>
              Las imágenes que elijas abajo se suman como ejemplos a ese estilo.
            </p>
          </>
        )}

        {/* Toggle incluir imágenes (solo al crear un estilo nuevo) */}
        {mode === 'new' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              fontSize: 12,
              color: 'var(--fg-2)',
              cursor: 'pointer',
            }}
            title="Si lo desmarcás, se guarda solo el texto del estilo (nombre + nota), sin imágenes — más liviano."
          >
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
            />
            Incluir imágenes de referencia
          </label>
        )}

        {/* Imágenes referenciales (uploads) */}
        {useImages && (
        <>
        <div style={{ ...fieldLabel, marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span>Imágenes referenciales</span>
          <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{refUrls.length} seleccionadas</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
            gap: 8,
            marginTop: 8,
          }}
        >
          {uploads.map((u) => (
            <div key={u.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--blue)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.dataUrl} alt="ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                style={removeBtn}
                title="Quitar"
              >
                <Icon.X size={10} />
              </button>
            </div>
          ))}
          <label style={uploadTile}>
            <input
              ref={fileRef}
              type="file"
              accept={SUPPORTED_IMAGE_MIMES.join(',')}
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Icon.Plus size={16} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>SUBIR</span>
          </label>
        </div>

        {/* Imágenes generadas del proyecto */}
        {generatedImages.length > 0 && (
          <>
            <div style={{ ...fieldLabel, marginTop: 16 }}>
              O usá imágenes generadas del proyecto como ejemplos
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {generatedImages.map((g) => {
                const on = pickedGenerated.has(g.url);
                return (
                  <button
                    key={g.url}
                    onClick={() => toggleGenerated(g.url)}
                    title={g.label}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      padding: 0,
                      cursor: 'pointer',
                      border: `1.5px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
                      boxShadow: on ? '0 0 0 3px var(--blue-soft)' : 'none',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.label || 'generada'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {on && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 99,
                          background: 'var(--blue)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Icon.Check size={10} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        </>
        )}

        {mode === 'new' && !includeImages && (
          <p style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Se guardará solo el texto del estilo (nombre + nota), sin imágenes.
          </p>
        )}

        {error && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--red-hi)' }}>⚠ {error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" icon={Icon.Save} onClick={save} loading={saving} disabled={!canSave} glow>
            Guardar estilo
          </Button>
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--fg-2)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--fg-1)',
  outline: 'none',
};

const uploadTile: React.CSSProperties = {
  aspectRatio: '1',
  borderRadius: 8,
  border: '1.5px dashed var(--line-strong)',
  background: 'var(--bg-1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  color: 'var(--fg-3)',
  cursor: 'pointer',
};

const removeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 3,
  width: 18,
  height: 18,
  borderRadius: 99,
  background: 'rgba(7,8,11,0.7)',
  color: '#fff',
  border: 'none',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};
