'use client';

/**
 * Botón OPT-IN "Guardar como avatar + contexto".
 *
 * Pensado para la fase de Scripts/Referencias: toma las imágenes de referencia
 * del personaje + el contexto (prompts) y, SOLO si el usuario lo pide, los
 * guarda como un avatar reutilizable. Nada se persiste automáticamente — esa es
 * justo la idea: guardar lo que te interesa, no todo lo que usas una vez.
 */
import React, { useEffect, useState } from 'react';
import { Badge, Button, Input } from '../koda-os/primitives';
import { Icon } from '../koda-os/icons';
import { fetchRegistry, saveBrand, saveAvatar } from '@/lib/avatar-registry';
import { DEFAULT_IDENTITY } from '@/types/avatar-registry';
import type { Brand } from '@/types/avatar-registry';

export interface SaveAsAvatarInlineProps {
  /** Imágenes de referencia (data: URLs). La 1ª será la principal. */
  images: string[];
  /** Contexto a guardar como persona (ej. prompt visual + narrativo). */
  context: string;
}

export default function SaveAsAvatarInline({ images, context }: SaveAsAvatarInlineProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchRegistry()
      .then((reg) => {
        setBrands(reg.brands);
        if (!brandId && reg.brands[0]) setBrandId(reg.brands[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSave = images.length > 0;

  async function createBrand() {
    const n = newBrand.trim();
    if (!n) return;
    try {
      const b = await saveBrand({ name: n });
      setBrands((prev) => [...prev.filter((x) => x.id !== b.id), b]);
      setBrandId(b.id);
      setNewBrand('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la marca.');
    }
  }

  async function save() {
    setError(null);
    if (!brandId) return setError('Elige o crea una marca.');
    if (!name.trim()) return setError('Ponle un nombre al avatar.');
    setSaving(true);
    try {
      await saveAvatar({
        brandId,
        name: name.trim(),
        identity: {
          ...DEFAULT_IDENTITY,
          primaryImageUrl: images[0],
          referenceImages: images.slice(1),
          personaNotes: context.trim(),
        },
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setName('');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (!canSave) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          borderRadius: 7,
          background: 'var(--bg-3)',
          border: '1px solid var(--line)',
          color: 'var(--fg-2)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}
        title="Guardar estas referencias + contexto como avatar reutilizable"
      >
        <Icon.Save size={12} /> Guardar como avatar
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon.Save size={14} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>Guardar como avatar</span>
        <span style={{ marginLeft: 'auto' }}>
          <Badge tone="default" size="sm">
            {images.length} img
          </Badge>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}
        >
          <Icon.X size={13} />
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: 'var(--red-hi)' }}>{error}</div>}
      {done ? (
        <div style={{ fontSize: 12, color: 'var(--success, #2ecc71)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon.Check size={13} /> Avatar guardado.
        </div>
      ) : (
        <>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            style={{
              height: 34,
              padding: '0 10px',
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              color: 'var(--fg-1)',
              fontSize: 13,
            }}
          >
            <option value="">— Marca —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="Nueva marca"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="secondary" size="sm" icon={Icon.Plus} onClick={createBrand}>
              Marca
            </Button>
          </div>
          <Input placeholder="Nombre del avatar" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="primary" size="md" icon={Icon.Save} onClick={save} loading={saving} style={{ width: '100%' }}>
            Guardar avatar + contexto
          </Button>
        </>
      )}
    </div>
  );
}
