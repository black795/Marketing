'use client';

/**
 * Sección propia de Avatares (/avatars) — crear y gestionar personajes.
 *
 * Aquí se guarda A PROPÓSITO: subes todas las imágenes, defines voz y atributos,
 * y pulsas Guardar. Nada se persiste solo. La pantalla de generación (/avatar)
 * solo CONSUME estos avatares vía AvatarPicker.
 *
 * Izquierda: marcas + sus avatares. Derecha: editor del avatar seleccionado.
 */
import React, { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Input, SectionHeader, Spinner, Textarea } from '../koda-os/primitives';
import { Icon } from '../koda-os/icons';
import {
  AVATAR_LANGUAGES,
  AVATAR_RESOLUTIONS,
  AVATAR_VOICES,
} from '@/lib/avatar';
import {
  fetchRegistry,
  saveBrand,
  saveAvatar,
  removeAvatar,
  removeBrand,
  toAbsoluteAsset,
} from '@/lib/avatar-registry';
import { DEFAULT_IDENTITY } from '@/types/avatar-registry';
import type { Avatar, AvatarRegistry } from '@/types/avatar-registry';
import type { AvatarResolution } from '@/types/avatar';

const selectStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--fg-1)',
  fontSize: 13,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--fg-3)',
  marginBottom: 6,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

interface EditorImage {
  id: string;
  /** data: URL (nueva) o ruta /assets (existente). */
  url: string;
}

interface EditorState {
  id?: string;
  brandId: string;
  name: string;
  images: EditorImage[];
  voice: string;
  voiceLanguage: string;
  resolution: AvatarResolution;
  videoPrompt: string;
  voicePrompt: string;
  personaNotes: string;
  seed: string; // como texto en el input; '' = sin seed
}

function emptyEditor(brandId: string): EditorState {
  return {
    brandId,
    name: '',
    images: [],
    voice: DEFAULT_IDENTITY.voice,
    voiceLanguage: DEFAULT_IDENTITY.voiceLanguage,
    resolution: DEFAULT_IDENTITY.resolution,
    videoPrompt: DEFAULT_IDENTITY.videoPrompt,
    voicePrompt: DEFAULT_IDENTITY.voicePrompt,
    personaNotes: '',
    seed: '',
  };
}

function editorFromAvatar(a: Avatar): EditorState {
  const imgs = [a.identity.primaryImageUrl, ...a.identity.referenceImages];
  return {
    id: a.id,
    brandId: a.brandId,
    name: a.name,
    images: imgs.map((url, i) => ({ id: `e-${i}-${url.slice(-8)}`, url })),
    voice: a.identity.voice,
    voiceLanguage: a.identity.voiceLanguage,
    resolution: a.identity.resolution as AvatarResolution,
    videoPrompt: a.identity.videoPrompt,
    voicePrompt: a.identity.voicePrompt,
    personaNotes: a.identity.personaNotes,
    seed: a.identity.seed != null ? String(a.identity.seed) : '',
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('No se pudo leer la imagen'));
    r.readAsDataURL(file);
  });
}

const display = (url: string) => (url.startsWith('data:') ? url : toAbsoluteAsset(url));

export default function AvatarsLibraryScreen() {
  const router = useRouter();
  const [registry, setRegistry] = useState<AvatarRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [newBrand, setNewBrand] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);

  async function refresh(keepEditor = false) {
    try {
      const reg = await fetchRegistry();
      setRegistry(reg);
      if (!selectedBrandId && reg.brands[0]) setSelectedBrandId(reg.brands[0].id);
      if (!keepEditor) setEditor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarsByBrand = useMemo(() => {
    const map = new Map<string, Avatar[]>();
    registry?.avatars.forEach((a) => map.set(a.brandId, [...(map.get(a.brandId) ?? []), a]));
    return map;
  }, [registry]);

  function patch(p: Partial<EditorState>) {
    setEditor((e) => (e ? { ...e, ...p } : e));
  }

  async function addImages(files: FileList | null) {
    if (!files || !editor) return;
    const urls = await Promise.all(Array.from(files).slice(0, 8).map(fileToDataUrl));
    patch({
      images: [
        ...editor.images,
        ...urls.filter(Boolean).map((url, i) => ({ id: `n-${Date.now()}-${i}`, url })),
      ],
    });
  }

  function setPrimary(id: string) {
    if (!editor) return;
    const idx = editor.images.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const next = [...editor.images];
    const [picked] = next.splice(idx, 1);
    patch({ images: [picked, ...next] });
  }

  function removeImage(id: string) {
    if (!editor) return;
    patch({ images: editor.images.filter((i) => i.id !== id) });
  }

  async function handleCreateBrand() {
    const name = newBrand.trim();
    if (!name) return;
    try {
      const brand = await saveBrand({ name });
      setNewBrand('');
      setSelectedBrandId(brand.id);
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la marca.');
    }
  }

  async function handleDeleteBrand(brandId: string) {
    if (!confirm('¿Borrar la marca y todos sus avatares?')) return;
    try {
      await removeBrand(brandId);
      if (selectedBrandId === brandId) setSelectedBrandId('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    }
  }

  async function handleSave() {
    if (!editor) return;
    setError(null);
    if (!editor.brandId) return setError('Elige una marca.');
    if (!editor.name.trim()) return setError('Ponle nombre al avatar.');
    if (editor.images.length === 0) return setError('Sube al menos una imagen.');

    const seedNum = editor.seed.trim() === '' ? null : Number(editor.seed);
    if (seedNum != null && (!Number.isInteger(seedNum) || seedNum < 0)) {
      return setError('La semilla debe ser un entero positivo o vacío.');
    }

    setSaving(true);
    try {
      await saveAvatar({
        id: editor.id,
        brandId: editor.brandId,
        name: editor.name.trim(),
        identity: {
          ...DEFAULT_IDENTITY,
          primaryImageUrl: editor.images[0].url,
          referenceImages: editor.images.slice(1).map((i) => i.url),
          voice: editor.voice,
          voiceLanguage: editor.voiceLanguage,
          resolution: editor.resolution,
          videoPrompt: editor.videoPrompt,
          voicePrompt: editor.voicePrompt,
          personaNotes: editor.personaNotes.trim(),
          seed: seedNum,
        },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAvatar(avatarId: string) {
    if (!confirm('¿Borrar este avatar?')) return;
    try {
      await removeAvatar(avatarId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    }
  }

  return (
    <div className="koda-os-root" style={{ minHeight: '100vh', background: 'var(--bg-0)', overflowY: 'auto' }}>
      <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/avatar')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--fg-3)',
            cursor: 'pointer',
            marginBottom: 12,
            background: 'transparent',
            border: 'none',
          }}
        >
          <Icon.ArrowL size={12} /> Volver a generar
        </button>

        <SectionHeader
          kicker="Biblioteca"
          title="Tus avatares"
          subtitle="Crea y guarda personajes con sus imágenes, voz y atributos. Luego reutilízalos en cada video desde la sección Avatar."
        />

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--red-soft)',
              border: '1px solid var(--red-ring)',
              color: 'var(--red-hi)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spinner size={26} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
            {/* --- Columna izquierda: marcas + avatares --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card padding={20}>
                <div style={labelStyle}>Marcas</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <Input
                    placeholder="Nueva marca"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button variant="secondary" size="md" icon={Icon.Plus} onClick={handleCreateBrand}>
                    Crear
                  </Button>
                </div>
                {(registry?.brands.length ?? 0) === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
                    Crea una marca para empezar (ej. "Inmobiliaria X").
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {registry!.brands.map((b) => {
                      const active = selectedBrandId === b.id;
                      const count = (avatarsByBrand.get(b.id) ?? []).length;
                      return (
                        <div
                          key={b.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: active ? 'var(--blue-soft)' : 'var(--bg-1)',
                            border: `1px solid ${active ? 'var(--blue-ring)' : 'var(--line)'}`,
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedBrandId(b.id)}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', flex: 1 }}>
                            {b.name}
                          </span>
                          <Badge tone="default" size="sm">
                            {count}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBrand(b.id);
                            }}
                            title="Borrar marca"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}
                          >
                            <Icon.Trash size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {selectedBrandId && (
                <Card padding={20}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ ...labelStyle, marginBottom: 0 }}>Avatares</div>
                    <span style={{ marginLeft: 'auto' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Icon.Plus}
                        onClick={() => setEditor(emptyEditor(selectedBrandId))}
                      >
                        Nuevo
                      </Button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {(avatarsByBrand.get(selectedBrandId) ?? []).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setEditor(editorFromAvatar(a))}
                        title={`Editar ${a.name}`}
                        style={{
                          width: 80,
                          borderRadius: 10,
                          border: `1px solid ${editor?.id === a.id ? 'var(--blue-ring)' : 'var(--line)'}`,
                          background: 'var(--bg-1)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <div style={{ aspectRatio: '1', background: '#000' }}>
                          <img
                            src={display(a.identity.primaryImageUrl)}
                            alt={a.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--fg-1)',
                            padding: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {a.name}
                        </div>
                      </button>
                    ))}
                    {(avatarsByBrand.get(selectedBrandId) ?? []).length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
                        Sin avatares en esta marca. Pulsa "Nuevo".
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* --- Columna derecha: editor --- */}
            <div>
              {editor ? (
                <Card padding={24}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 600,
                        margin: 0,
                        color: 'var(--fg-1)',
                      }}
                    >
                      {editor.id ? 'Editar avatar' : 'Nuevo avatar'}
                    </h3>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      {editor.id && (
                        <Button
                          variant="secondary"
                          size="md"
                          icon={Icon.Trash}
                          onClick={() => handleDeleteAvatar(editor.id!)}
                        >
                          Borrar
                        </Button>
                      )}
                      <Button variant="primary" size="md" icon={Icon.Save} onClick={handleSave} loading={saving}>
                        Guardar
                      </Button>
                    </span>
                  </div>

                  {/* Imágenes */}
                  <div style={labelStyle}>Imágenes (la 1ª es la principal)</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                      gap: 10,
                      marginBottom: 18,
                    }}
                  >
                    {editor.images.map((img, idx) => (
                      <div
                        key={img.id}
                        style={{
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: 10,
                          overflow: 'hidden',
                          border: `2px solid ${idx === 0 ? 'var(--red)' : 'var(--line)'}`,
                          background: 'var(--bg-1)',
                        }}
                      >
                        <img
                          src={display(img.url)}
                          alt={`img ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: idx === 0 ? 'default' : 'pointer' }}
                          onClick={() => setPrimary(img.id)}
                          title={idx === 0 ? 'Principal' : 'Click para hacer principal'}
                        />
                        {idx === 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: 'var(--red)',
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            PRINCIPAL
                          </span>
                        )}
                        <button
                          onClick={() => removeImage(img.id)}
                          title="Quitar"
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: 99,
                            background: 'rgba(7,8,11,0.7)',
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            border: 'none',
                          }}
                        >
                          <Icon.X size={10} />
                        </button>
                      </div>
                    ))}
                    <label
                      style={{
                        aspectRatio: '1',
                        borderRadius: 10,
                        border: '2px dashed var(--line-strong)',
                        background: 'var(--bg-1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        color: 'var(--fg-3)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          addImages(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <Icon.Upload size={16} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>SUBIR</span>
                    </label>
                  </div>

                  {/* Nombre */}
                  <div style={{ marginBottom: 14 }}>
                    <Input
                      label="Nombre"
                      placeholder="ej. Lucía"
                      value={editor.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </div>

                  {/* Voz / idioma / resolución */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={labelStyle}>Voz</div>
                      <select style={selectStyle} value={editor.voice} onChange={(e) => patch({ voice: e.target.value })}>
                        {AVATAR_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={labelStyle}>Idioma</div>
                      <select
                        style={selectStyle}
                        value={editor.voiceLanguage}
                        onChange={(e) => patch({ voiceLanguage: e.target.value })}
                      >
                        {AVATAR_LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={labelStyle}>Resolución</div>
                      <select
                        style={selectStyle}
                        value={editor.resolution}
                        onChange={(e) => patch({ resolution: e.target.value as AvatarResolution })}
                      >
                        {AVATAR_RESOLUTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Atributos de comportamiento */}
                  <div style={{ marginBottom: 14 }}>
                    <Textarea
                      label="Comportamiento (video prompt)"
                      rows={2}
                      value={editor.videoPrompt}
                      onChange={(e) => patch({ videoPrompt: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <Textarea
                      label="Estilo de voz (voice prompt)"
                      rows={2}
                      value={editor.voicePrompt}
                      onChange={(e) => patch({ voicePrompt: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <Textarea
                      label="Persona / contexto"
                      hint="personalidad, tono, do/don't"
                      rows={3}
                      value={editor.personaNotes}
                      onChange={(e) => patch({ personaNotes: e.target.value })}
                    />
                  </div>
                  <div style={{ maxWidth: 200 }}>
                    <Input
                      label="Seed (opcional)"
                      placeholder="vacío = aleatorio"
                      value={editor.seed}
                      onChange={(e) => patch({ seed: e.target.value })}
                    />
                  </div>
                </Card>
              ) : (
                <Card padding={48}>
                  <div style={{ textAlign: 'center', color: 'var(--fg-3)' }}>
                    <Icon.Mask size={32} />
                    <p style={{ fontSize: 14, marginTop: 12 }}>
                      {selectedBrandId
                        ? 'Selecciona un avatar para editarlo o pulsa "Nuevo".'
                        : 'Crea o elige una marca a la izquierda para empezar.'}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
