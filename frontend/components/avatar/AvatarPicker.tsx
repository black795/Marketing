'use client';

/**
 * Picker de avatares — versión COMPACTA para la pantalla de generación.
 *
 * Solo deja ELEGIR un avatar guardado para cargarlo al formulario. NO guarda
 * nada: gestionar/crear avatares vive en su propia sección (/avatars). Así la
 * pantalla de Avatar queda enfocada en "imagen + guion → video".
 */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, Spinner } from '../koda-os/primitives';
import { Icon } from '../koda-os/icons';
import { fetchRegistry, toAbsoluteAsset } from '@/lib/avatar-registry';
import type { Avatar, AvatarRegistry } from '@/types/avatar-registry';

export default function AvatarPicker({ onPick }: { onPick: (avatar: Avatar) => void }) {
  const [registry, setRegistry] = useState<AvatarRegistry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegistry()
      .then(setRegistry)
      .catch(() => setRegistry(null))
      .finally(() => setLoading(false));
  }, []);

  const byBrand = useMemo(() => {
    const map = new Map<string, Avatar[]>();
    registry?.avatars.forEach((a) => map.set(a.brandId, [...(map.get(a.brandId) ?? []), a]));
    return map;
  }, [registry]);

  const hasAvatars = (registry?.avatars.length ?? 0) > 0;

  return (
    <Card padding={24}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Icon.Star size={16} />
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            margin: 0,
            color: 'var(--fg-1)',
          }}
        >
          Usar un avatar guardado
        </h3>
        <span style={{ marginLeft: 'auto' }}>
          <Link
            href="/avatars"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--blue-hi)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Gestionar <Icon.Arrow size={12} />
          </Link>
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
          <Spinner size={20} />
        </div>
      ) : hasAvatars ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {registry!.brands
            .filter((b) => (byBrand.get(b.id) ?? []).length > 0)
            .map((b) => (
              <div key={b.id}>
                <div
                  className="mono upper"
                  style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: 1, marginBottom: 8 }}
                >
                  {b.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {(byBrand.get(b.id) ?? []).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => onPick(a)}
                      title={`Usar ${a.name}`}
                      style={{
                        width: 72,
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg-1)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div style={{ aspectRatio: '1', background: '#000' }}>
                        <img
                          src={toAbsoluteAsset(a.identity.primaryImageUrl)}
                          alt={a.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--fg-1)',
                          padding: '4px 4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {a.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
          No tienes avatares guardados.{' '}
          <Link href="/avatars" style={{ color: 'var(--blue-hi)', fontWeight: 600 }}>
            Crear uno
          </Link>{' '}
          para reutilizarlo en cada video.
        </p>
      )}
    </Card>
  );
}
