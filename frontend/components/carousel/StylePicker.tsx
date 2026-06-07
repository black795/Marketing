'use client';

// Selector de la Biblioteca de Estilos Visuales para la config del carrusel.
// Lista los estilos guardados (thumbnail + nombre), permite seleccionar uno
// (para que el generador lo imite) y borrarlos. Carga sola desde el backend.

import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../koda-os/icons';
import { Badge } from '../koda-os/primitives';
import { fetchVisualStyles, deleteVisualStyle } from '@/lib/visual-styles';
import type { VisualStyle } from '@/types/visual-style';

interface Props {
  selectedId: string | null;
  onApply: (style: VisualStyle) => void;
  onClear: () => void;
}

export default function StylePicker({ selectedId, onApply, onClear }: Props) {
  const [styles, setStyles] = useState<VisualStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchVisualStyles()
      .then((reg) => setStyles(reg.styles))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function remove(id: string) {
    try {
      await deleteVisualStyle(id);
      if (selectedId === id) onClear();
      load();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          Estilos guardados {styles.length > 0 ? `(${styles.length})` : ''}
        </span>
        {selectedId && (
          <button
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          >
            quitar estilo
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>Cargando…</p>
      ) : error ? (
        <p style={{ fontSize: 11, color: 'var(--red-hi)', margin: 0 }}>{error}</p>
      ) : styles.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0, lineHeight: 1.5 }}>
          Todavía no guardaste estilos. Terminá un carrusel y tocá “Guardar estilo” para reutilizar su look acá.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {styles.map((s) => {
            const active = s.id === selectedId;
            return (
              <div key={s.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => onApply(s)}
                  title={s.styleNote || s.name}
                  style={{
                    width: 132,
                    textAlign: 'left',
                    padding: 0,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--bg-1)',
                    border: `1.5px solid ${active ? 'var(--blue)' : 'var(--line)'}`,
                    boxShadow: active ? '0 0 0 3px var(--blue-soft)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ aspectRatio: '4 / 3', background: 'var(--bg-3)' }}>
                    {s.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.thumbnailUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--fg-3)' }}>
                        <Icon.Image size={20} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--blue-hi)' : 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--fg-3)' }}>
                      {s.references.length} ref · {s.stats.uses} usos
                    </div>
                  </div>
                </button>
                {active && (
                  <span style={{ position: 'absolute', top: 6, left: 6 }}>
                    <Badge tone="blue" size="sm" icon={Icon.Check}>aplicado</Badge>
                  </span>
                )}
                <button
                  onClick={() => void remove(s.id)}
                  aria-label={`Borrar estilo ${s.name}`}
                  title="Borrar estilo"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    background: 'rgba(7,8,11,0.8)',
                    color: 'var(--red-hi)',
                    border: '1px solid var(--line-strong)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <Icon.Trash size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
