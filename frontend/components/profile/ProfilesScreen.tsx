'use client';

/**
 * Sección de Perfiles / Dominios de uso (/profiles).
 *
 * Crear y gestionar perfiles tipo "Agente Inmobiliario": contexto del dominio,
 * avatares vinculados, referencias visuales y biblioteca de ejemplos. Todo
 * guardado a propósito. El PromptScreen consume el perfil seleccionado e inyecta
 * su contexto en el guion.
 */
import React, { type CSSProperties, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Input, SectionHeader, Spinner, Textarea } from '../koda-os/primitives';
import { Icon } from '../koda-os/icons';
import {
  fetchProfiles,
  saveProfile,
  removeProfile,
  addProfileExample,
  removeProfileExample,
} from '@/lib/profiles';
import { fetchRegistry, toAbsoluteAsset } from '@/lib/avatar-registry';
import type { Profile, ProfileRegistry } from '@/types/profile';
import type { Avatar } from '@/types/avatar-registry';

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--fg-3)',
  marginBottom: 6,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

interface EditorState {
  id?: string;
  name: string;
  domain: string;
  systemContext: string;
  tone: string;
  dos: string;
  donts: string;
  avatarIds: string[];
  refImages: { id: string; url: string }[];
}

function emptyEditor(): EditorState {
  return { name: '', domain: '', systemContext: '', tone: '', dos: '', donts: '', avatarIds: [], refImages: [] };
}

function editorFromProfile(p: Profile): EditorState {
  return {
    id: p.id,
    name: p.name,
    domain: p.domain,
    systemContext: p.systemContext,
    tone: p.tone,
    dos: p.dos,
    donts: p.donts,
    avatarIds: [...p.avatarIds],
    refImages: p.referenceImages.map((url, i) => ({ id: `r-${i}-${url.slice(-8)}`, url })),
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

export default function ProfilesScreen() {
  const router = useRouter();
  const [registry, setRegistry] = useState<ProfileRegistry | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [newExample, setNewExample] = useState('');

  async function refresh(keepEditorId?: string) {
    try {
      const [reg, avReg] = await Promise.all([fetchProfiles(), fetchRegistry().catch(() => null)]);
      setRegistry(reg);
      if (avReg) setAvatars(avReg.avatars);
      if (keepEditorId) {
        const fresh = reg.profiles.find((p) => p.id === keepEditorId);
        if (fresh) setEditor(editorFromProfile(fresh));
      }
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

  const currentProfile = editor?.id ? registry?.profiles.find((p) => p.id === editor.id) ?? null : null;

  function patch(p: Partial<EditorState>) {
    setEditor((e) => (e ? { ...e, ...p } : e));
  }

  function toggleAvatar(id: string) {
    if (!editor) return;
    patch({
      avatarIds: editor.avatarIds.includes(id)
        ? editor.avatarIds.filter((x) => x !== id)
        : [...editor.avatarIds, id],
    });
  }

  async function addRefs(files: FileList | null) {
    if (!files || !editor) return;
    const urls = await Promise.all(Array.from(files).slice(0, 8).map(fileToDataUrl));
    patch({
      refImages: [...editor.refImages, ...urls.filter(Boolean).map((url, i) => ({ id: `n-${Date.now()}-${i}`, url }))],
    });
  }

  async function handleSave() {
    if (!editor) return;
    setError(null);
    if (!editor.name.trim()) return setError('Ponle nombre al perfil.');
    setSaving(true);
    try {
      const saved = await saveProfile({
        id: editor.id,
        name: editor.name.trim(),
        domain: editor.domain.trim(),
        systemContext: editor.systemContext.trim(),
        tone: editor.tone.trim(),
        dos: editor.dos.trim(),
        donts: editor.donts.trim(),
        avatarIds: editor.avatarIds,
        referenceImages: editor.refImages.map((r) => r.url),
      });
      await refresh(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar este perfil?')) return;
    try {
      await removeProfile(id);
      setEditor(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    }
  }

  async function handleAddExample() {
    if (!editor?.id || !newExample.trim()) return;
    try {
      await addProfileExample(editor.id, 'prompt', newExample.trim());
      setNewExample('');
      await refresh(editor.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo añadir ejemplo.');
    }
  }

  async function handleRemoveExample(exampleId: string) {
    if (!editor?.id) return;
    try {
      await removeProfileExample(editor.id, exampleId);
      await refresh(editor.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar ejemplo.');
    }
  }

  return (
    <div className="koda-os-root" style={{ minHeight: '100vh', background: 'var(--bg-0)', overflowY: 'auto' }}>
      <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
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
          <Icon.ArrowL size={12} /> Inicio
        </button>

        <SectionHeader
          kicker="Dominios de uso"
          title="Perfiles"
          subtitle="Crea contextos por rubro (ej. agente inmobiliario). Al generar un guion, el perfil sesga el resultado hacia ese dominio y trae sus avatares y referencias."
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
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
            {/* --- Lista de perfiles --- */}
            <Card padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 0 }}>Perfiles</div>
                <span style={{ marginLeft: 'auto' }}>
                  <Button variant="primary" size="sm" icon={Icon.Plus} onClick={() => setEditor(emptyEditor())}>
                    Nuevo
                  </Button>
                </span>
              </div>
              {(registry?.profiles.length ?? 0) === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
                  Sin perfiles. Crea uno (ej. "Agente Inmobiliario").
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {registry!.profiles.map((p) => {
                    const active = editor?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditor(editorFromProfile(p))}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: active ? 'var(--blue-soft)' : 'var(--bg-1)',
                          border: `1px solid ${active ? 'var(--blue-ring)' : 'var(--line)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                          {p.domain || 'sin rubro'} · {p.examples.length} ej · {p.avatarIds.length} avatares
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* --- Editor --- */}
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
                      {editor.id ? 'Editar perfil' : 'Nuevo perfil'}
                    </h3>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      {editor.id && (
                        <Button variant="secondary" size="md" icon={Icon.Trash} onClick={() => handleDelete(editor.id!)}>
                          Borrar
                        </Button>
                      )}
                      <Button variant="primary" size="md" icon={Icon.Save} onClick={handleSave} loading={saving}>
                        Guardar
                      </Button>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <Input label="Nombre" placeholder="ej. Agente Inmobiliario" value={editor.name} onChange={(e) => patch({ name: e.target.value })} />
                    <Input label="Rubro / dominio" placeholder="ej. real estate" value={editor.domain} onChange={(e) => patch({ domain: e.target.value })} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <Textarea
                      label="Contexto del dominio"
                      hint="quién, para quién, objetivo"
                      rows={3}
                      placeholder="Ej. Agente que vende propiedades residenciales a familias jóvenes; objetivo: agendar visitas."
                      value={editor.systemContext}
                      onChange={(e) => patch({ systemContext: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <Textarea label="Tono" rows={2} value={editor.tone} onChange={(e) => patch({ tone: e.target.value })} />
                    <Textarea label="Hacer" rows={2} value={editor.dos} onChange={(e) => patch({ dos: e.target.value })} />
                    <Textarea label="Evitar" rows={2} value={editor.donts} onChange={(e) => patch({ donts: e.target.value })} />
                  </div>

                  {/* Avatares vinculados */}
                  <div style={labelStyle}>Avatares vinculados</div>
                  {avatars.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 16px' }}>
                      No hay avatares. Créalos en la sección Avatares para vincularlos.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {avatars.map((a) => {
                        const on = editor.avatarIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => toggleAvatar(a.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '4px 10px 4px 4px',
                              borderRadius: 99,
                              background: on ? 'var(--blue-soft)' : 'var(--bg-1)',
                              border: `1px solid ${on ? 'var(--blue-ring)' : 'var(--line)'}`,
                              cursor: 'pointer',
                            }}
                          >
                            <img
                              src={display(a.identity.primaryImageUrl)}
                              alt={a.name}
                              style={{ width: 24, height: 24, borderRadius: 99, objectFit: 'cover' }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--blue-hi)' : 'var(--fg-1)' }}>
                              {a.name}
                            </span>
                            {on && <Icon.Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Referencias visuales */}
                  <div style={labelStyle}>Referencias visuales del rubro</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                    {editor.refImages.map((img) => (
                      <div
                        key={img.id}
                        style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}
                      >
                        <img src={display(img.url)} alt="ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => patch({ refImages: editor.refImages.filter((r) => r.id !== img.id) })}
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            borderRadius: 99,
                            background: 'rgba(7,8,11,0.7)',
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            border: 'none',
                          }}
                        >
                          <Icon.X size={9} />
                        </button>
                      </div>
                    ))}
                    <label
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        border: '2px dashed var(--line-strong)',
                        background: 'var(--bg-1)',
                        display: 'grid',
                        placeItems: 'center',
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
                          addRefs(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <Icon.Upload size={16} />
                    </label>
                  </div>

                  {/* Biblioteca de ejemplos */}
                  <div style={labelStyle}>Biblioteca de ejemplos (few-shot)</div>
                  {!editor.id ? (
                    <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
                      Guarda el perfil primero para añadir ejemplos.
                    </p>
                  ) : (
                    <>
                      {currentProfile && currentProfile.examples.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                          {currentProfile.examples.map((ex) => (
                            <div
                              key={ex.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                                padding: '8px 10px',
                                borderRadius: 8,
                                background: 'var(--bg-1)',
                                border: '1px solid var(--line)',
                              }}
                            >
                              <Badge tone="default" size="sm">
                                {ex.kind}
                              </Badge>
                              <span style={{ fontSize: 12, color: 'var(--fg-2)', flex: 1 }}>{ex.text}</span>
                              <button
                                onClick={() => handleRemoveExample(ex.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}
                              >
                                <Icon.Trash size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 10px' }}>
                          Aún sin ejemplos. Se llenan aquí o desde Scripts al aprobar un guion.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          placeholder="Añadir un ejemplo de prompt que funcione…"
                          value={newExample}
                          onChange={(e) => setNewExample(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <Button variant="secondary" size="md" icon={Icon.Plus} onClick={handleAddExample}>
                          Añadir
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card padding={48}>
                  <div style={{ textAlign: 'center', color: 'var(--fg-3)' }}>
                    <Icon.Layers size={32} />
                    <p style={{ fontSize: 14, marginTop: 12 }}>Selecciona un perfil o crea uno nuevo.</p>
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
