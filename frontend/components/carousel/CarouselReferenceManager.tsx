'use client';

// Sistema de referencias visuales del Carousel Generator.
//
// Dos bloques:
//   PRINCIPAL    — imágenes del producto. Subir una o varias, marcar una como
//                  principal. tipo = 'producto'.
//   SECUNDARIAS  — logos, branding, ejemplos, capturas, mockups. Se elige la
//                  categoría (tipo) antes de subir; se puede recategorizar.
//
// Cada imagen guarda: id, url, tipo, nombre, fecha (+ bytes/dims opcionales).
// Soporta drag & drop para subir, drag para reordenar, eliminar y preview.
// Reutiliza los helpers de `lib/image-upload` (compartidos con los otros
// uploaders) y los primitives de Koda OS. NO genera imágenes: deja el set
// listo para mandarlo a GPT Image 2 como input_images.

import React, { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '../koda-os/icons';
import { Badge } from '../koda-os/primitives';
import {
  SUPPORTED_IMAGE_MIMES,
  isSupportedImageMime,
  makeImageId,
  resizeImageToDataUrl,
  formatBytes,
} from '@/lib/image-upload';
import {
  CAROUSEL_REFERENCE_LIMITS,
  CAROUSEL_SECONDARY_KINDS,
  type CarouselReference,
  type CarouselReferenceKind,
  type CarouselReferences,
} from '@/types/carousel';

interface Props {
  value: CarouselReferences;
  onChange: (next: CarouselReferences) => void;
  disabled?: boolean;
}

const KIND_LABEL: Record<CarouselReferenceKind, string> = {
  producto: 'Producto',
  logo: 'Logo',
  branding: 'Branding',
  ejemplo: 'Ejemplo',
  captura: 'Captura',
  mockup: 'Mockup',
};

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function CarouselReferenceManager({ value, onChange, disabled = false }: Props) {
  const [secondaryKind, setSecondaryKind] = useState<CarouselReferenceKind>('logo');

  // ---- mutadores inmutables sobre el set completo ----
  const addPrincipal = useCallback(
    (refs: CarouselReference[]) => {
      const principal = [...value.principal, ...refs].slice(0, CAROUSEL_REFERENCE_LIMITS.maxPrincipal);
      // Auto-marca la primera como principal si no hay ninguna.
      const principalId = value.principalId ?? principal[0]?.id ?? null;
      onChange({ ...value, principal, principalId });
    },
    [value, onChange],
  );

  const addSecundarias = useCallback(
    (refs: CarouselReference[]) => {
      const secundarias = [...value.secundarias, ...refs].slice(0, CAROUSEL_REFERENCE_LIMITS.maxSecundarias);
      onChange({ ...value, secundarias });
    },
    [value, onChange],
  );

  function removePrincipal(id: string) {
    const principal = value.principal.filter((r) => r.id !== id);
    const principalId = value.principalId === id ? (principal[0]?.id ?? null) : value.principalId;
    onChange({ ...value, principal, principalId });
  }

  function removeSecundaria(id: string) {
    onChange({ ...value, secundarias: value.secundarias.filter((r) => r.id !== id) });
  }

  function setPrincipalId(id: string) {
    onChange({ ...value, principalId: id });
  }

  function movePrincipal(from: number, to: number) {
    onChange({ ...value, principal: reorder(value.principal, from, to) });
  }

  function moveSecundaria(from: number, to: number) {
    onChange({ ...value, secundarias: reorder(value.secundarias, from, to) });
  }

  function recategorize(id: string, tipo: CarouselReferenceKind) {
    onChange({
      ...value,
      secundarias: value.secundarias.map((r) => (r.id === id ? { ...r, tipo } : r)),
    });
  }

  const remainingPrincipal = CAROUSEL_REFERENCE_LIMITS.maxPrincipal - value.principal.length;
  const remainingSecundarias = CAROUSEL_REFERENCE_LIMITS.maxSecundarias - value.secundarias.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ===================== PRINCIPAL ===================== */}
      <section>
        <SectionLabel
          title="Referencia principal — producto"
          hint="Subí una o varias fotos del producto. Marcá una como principal (la que mejor lo representa)."
          count={`${value.principal.length}/${CAROUSEL_REFERENCE_LIMITS.maxPrincipal}`}
        />
        <Dropzone
          label="Arrastrá las fotos del producto"
          remaining={remainingPrincipal}
          disabled={disabled}
          tipo="producto"
          onFiles={addPrincipal}
        />
        {value.principal.length > 0 && (
          <ReferenceGrid
            items={value.principal}
            disabled={disabled}
            selectedId={value.principalId}
            onSelect={setPrincipalId}
            onRemove={removePrincipal}
            onMove={movePrincipal}
          />
        )}
      </section>

      {/* ===================== SECUNDARIAS ===================== */}
      <section>
        <SectionLabel
          title="Referencias secundarias"
          hint="Logos, branding, ejemplos visuales, capturas y mockups que guíen el estilo."
          count={`${value.secundarias.length}/${CAROUSEL_REFERENCE_LIMITS.maxSecundarias}`}
        />

        {/* Selector de categoría para las próximas subidas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {CAROUSEL_SECONDARY_KINDS.map((k) => {
            const active = secondaryKind === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setSecondaryKind(k.id)}
                disabled={disabled}
                title={k.description}
                style={{
                  padding: '6px 12px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: active ? 'var(--blue-soft)' : 'var(--bg-1)',
                  color: active ? 'var(--blue-hi)' : 'var(--fg-2)',
                  border: `1px solid ${active ? 'var(--blue-ring)' : 'var(--line)'}`,
                  transition: 'all 160ms var(--ease-out)',
                }}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        <Dropzone
          label={`Arrastrá ${KIND_LABEL[secondaryKind].toLowerCase()} o seleccioná archivos`}
          remaining={remainingSecundarias}
          disabled={disabled}
          tipo={secondaryKind}
          onFiles={addSecundarias}
        />
        {value.secundarias.length > 0 && (
          <ReferenceGrid
            items={value.secundarias}
            disabled={disabled}
            onRemove={removeSecundaria}
            onMove={moveSecundaria}
            onRecategorize={recategorize}
          />
        )}
      </section>
    </div>
  );
}

// =====================================================================
// Dropzone — área de subida (drag & drop + click). Procesa archivos con los
// helpers compartidos y emite CarouselReference[] etiquetadas con `tipo`.
// =====================================================================
function Dropzone({
  label,
  remaining,
  disabled,
  tipo,
  onFiles,
}: {
  label: string;
  remaining: number;
  disabled: boolean;
  tipo: CarouselReferenceKind;
  onFiles: (refs: CarouselReference[]) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const full = remaining <= 0;
  const busy = disabled || processing > 0;

  const process = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      setError(null);
      if (full) {
        setError('Alcanzaste el máximo de imágenes para esta sección.');
        return;
      }

      const valid: File[] = [];
      let skipped = 0;
      for (const f of Array.from(files)) {
        if (!isSupportedImageMime(f.type) || f.size > CAROUSEL_REFERENCE_LIMITS.maxBytes) {
          skipped++;
          continue;
        }
        valid.push(f);
      }
      const toProcess = valid.slice(0, remaining);
      const overflow = valid.length - toProcess.length;
      if (toProcess.length === 0) {
        setError(skipped > 0 ? `${skipped} archivo(s) no soportado(s) o demasiado grande(s).` : 'Sin archivos válidos.');
        return;
      }

      setProcessing(toProcess.length);
      const out: CarouselReference[] = [];
      try {
        for (const f of toProcess) {
          try {
            const { dataUrl, bytes, width, height } = await resizeImageToDataUrl(
              f,
              CAROUSEL_REFERENCE_LIMITS.maxSidePx,
            );
            out.push({
              id: makeImageId('cref'),
              url: dataUrl,
              tipo,
              nombre: f.name,
              fecha: new Date().toISOString(),
              bytes,
              width,
              height,
            });
          } catch {
            skipped++;
          }
        }
        if (out.length > 0) onFiles(out);
      } finally {
        setProcessing(0);
      }

      const msgs: string[] = [];
      if (skipped > 0) msgs.push(`${skipped} descartada(s)`);
      if (overflow > 0) msgs.push(`${overflow} ignorada(s) por límite`);
      setError(msgs.length ? msgs.join(' · ') : null);
    },
    [disabled, full, remaining, tipo, onFiles],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && !full) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy && e.dataTransfer.files?.length) void process(e.dataTransfer.files);
        }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '18px 16px',
          borderRadius: 12,
          textAlign: 'center',
          border: `1.5px dashed ${dragOver ? 'var(--blue)' : 'var(--line-strong)'}`,
          background: dragOver ? 'var(--blue-soft)' : 'var(--bg-1)',
          opacity: busy || full ? 0.65 : 1,
          transition: 'all 160ms var(--ease-out)',
        }}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={SUPPORTED_IMAGE_MIMES.join(',')}
          multiple
          disabled={busy || full}
          onChange={(e) => {
            if (e.target.files?.length) void process(e.target.files);
            e.target.value = '';
          }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        <Icon.Upload size={22} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
          {label}{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || full}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--blue-hi)',
              fontWeight: 700,
              cursor: busy || full ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            seleccioná
          </button>
        </p>
        <p className="mono" style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)' }}>
          JPG/PNG/WEBP · máx {formatBytes(CAROUSEL_REFERENCE_LIMITS.maxBytes)} c/u ·{' '}
          {full ? 'límite alcanzado' : `${remaining} disponibles`}
        </p>
        {processing > 0 && (
          <span
            className="mono"
            style={{
              marginTop: 4,
              fontSize: 11,
              color: 'var(--blue-hi)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className="breath" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--blue)' }} />
            Procesando {processing}…
          </span>
        )}
      </div>
      {error && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--red-hi)' }}>{error}</p>}
    </div>
  );
}

// =====================================================================
// ReferenceGrid — preview + reordenamiento (drag o flechas) + eliminar +
// (opcional) marcar principal / recategorizar.
// =====================================================================
function ReferenceGrid({
  items,
  disabled,
  selectedId,
  onSelect,
  onRemove,
  onMove,
  onRecategorize,
}: {
  items: CarouselReference[];
  disabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onRecategorize?: (id: string, tipo: CarouselReferenceKind) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: '12px 0 0',
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
      }}
    >
      {items.map((ref, idx) => {
        const active = selectedId != null && ref.id === selectedId;
        return (
          <li
            key={ref.id}
            draggable={!disabled}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx != null && dragIdx !== idx) onMove(dragIdx, idx);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--bg-2)',
              border: `1.5px solid ${active ? 'var(--blue)' : 'var(--line)'}`,
              boxShadow: active ? '0 0 0 3px var(--blue-soft)' : 'var(--shadow-sm)',
              opacity: dragIdx === idx ? 0.5 : 1,
              cursor: disabled ? 'default' : 'grab',
            }}
          >
            <div style={{ aspectRatio: '1 / 1', background: 'var(--bg-3)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ref.url} alt={ref.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>

            {/* badge orden / tipo */}
            <span
              className="mono"
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                padding: '2px 7px',
                borderRadius: 99,
                background: 'rgba(7,8,11,0.78)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                backdropFilter: 'blur(6px)',
              }}
            >
              #{idx + 1} · {KIND_LABEL[ref.tipo]}
            </span>

            {active && (
              <span style={{ position: 'absolute', top: 6, right: 6 }}>
                <Badge tone="blue" size="sm" icon={Icon.Check}>
                  principal
                </Badge>
              </span>
            )}

            {/* eliminar */}
            <button
              type="button"
              onClick={() => onRemove(ref.id)}
              disabled={disabled}
              aria-label={`Quitar ${ref.nombre}`}
              title="Quitar"
              style={{
                position: 'absolute',
                bottom: 34,
                right: 6,
                width: 24,
                height: 24,
                borderRadius: 99,
                background: 'rgba(7,8,11,0.8)',
                color: 'var(--red-hi)',
                border: '1px solid var(--line-strong)',
                display: 'grid',
                placeItems: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Icon.Trash size={12} />
            </button>

            {/* barra inferior: marcar principal / mover / recategorizar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 4,
                padding: '5px 6px',
                borderTop: '1px solid var(--line)',
              }}
            >
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(ref.id)}
                  disabled={disabled || active}
                  title={active ? 'Es la principal' : 'Marcar como principal'}
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 5,
                    border: 'none',
                    cursor: disabled || active ? 'default' : 'pointer',
                    background: active ? 'var(--blue-soft)' : 'transparent',
                    color: active ? 'var(--blue-hi)' : 'var(--fg-3)',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {active ? '★ principal' : '☆ marcar'}
                </button>
              ) : onRecategorize ? (
                <select
                  value={ref.tipo}
                  disabled={disabled}
                  onChange={(e) => onRecategorize(ref.id, e.target.value as CarouselReferenceKind)}
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 5,
                    border: '1px solid var(--line)',
                    background: 'var(--bg-1)',
                    color: 'var(--fg-2)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {CAROUSEL_SECONDARY_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}

              <span style={{ display: 'flex', gap: 2 }}>
                <MoveBtn dir="‹" disabled={disabled || idx === 0} onClick={() => onMove(idx, idx - 1)} />
                <MoveBtn dir="›" disabled={disabled || idx === items.length - 1} onClick={() => onMove(idx, idx + 1)} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MoveBtn({ dir, disabled, onClick }: { dir: '‹' | '›'; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === '‹' ? 'Mover antes' : 'Mover después'}
      style={{
        width: 20,
        height: 22,
        borderRadius: 5,
        border: '1px solid var(--line)',
        background: 'var(--bg-1)',
        color: 'var(--fg-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        fontSize: 13,
        lineHeight: 1,
      }}
    >
      {dir}
    </button>
  );
}

// ---------- Section label ----------
function SectionLabel({ title, hint, count }: { title: string; hint: string; count: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>
          {title}
        </h4>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {count}
        </span>
      </div>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>{hint}</p>
    </div>
  );
}
