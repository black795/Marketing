'use client';

// Selector de presets de estética (Realista / Cartoon / Anime / 3D…).
// Reutilizable en Scripts y Carruseles. Devuelve el id elegido (o null).

import React from 'react';
import { AESTHETIC_PRESETS } from '@/types/aesthetic';

export default function AestheticPicker({
  selectedId,
  onSelect,
  compact = false,
}: {
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  /** compact: chips más chicos sin blurb (para sidebars angostos). */
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact
          ? 'repeat(auto-fill, minmax(96px, 1fr))'
          : 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 8,
      }}
    >
      {AESTHETIC_PRESETS.map((p) => {
        const selected = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(selected ? null : p.id)}
            title={p.blurb}
            style={{
              textAlign: 'left',
              padding: compact ? '8px 10px' : '10px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              background: selected ? 'var(--blue-soft)' : 'var(--bg-1)',
              border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--line)'}`,
              boxShadow: selected ? '0 0 0 3px var(--blue-soft)' : 'none',
              transition: 'all 180ms var(--ease-out)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{p.emoji}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: selected ? 'var(--blue-hi)' : 'var(--fg-1)',
                }}
              >
                {p.label}
              </span>
            </div>
            {!compact && (
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.4 }}>
                {p.blurb}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
