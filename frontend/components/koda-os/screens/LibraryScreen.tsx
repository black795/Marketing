'use client';

// Hub de Biblioteca — gestiona el "learning" del sistema en un solo lugar:
// Estilos visuales y Guiones favoritos (borrar / crear / ver), con accesos
// directos a Perfiles y Avatares (que tienen su propia pantalla).

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icons';
import { Badge, Button, Card, SectionHeader } from '../primitives';
import StyleCreatorModal from '../StyleCreatorModal';
import { fetchVisualStyles, deleteVisualStyle } from '@/lib/visual-styles';
import { fetchFavoriteScripts, deleteFavoriteScript } from '@/lib/script-library';
import type { VisualStyle } from '@/types/visual-style';
import type { FavoriteScript } from '@/types/script-favorite';

type Tab = 'styles' | 'scripts';

export default function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('styles');
  const [styles, setStyles] = useState<VisualStyle[]>([]);
  const [scripts, setScripts] = useState<FavoriteScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([
      fetchVisualStyles().then((r) => setStyles(r.styles)).catch(() => {}),
      fetchFavoriteScripts().then((r) => setScripts(r.scripts)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }
  useEffect(() => reload(), []);

  async function removeStyle(id: string) {
    await deleteVisualStyle(id).catch(() => {});
    setStyles((prev) => prev.filter((s) => s.id !== id));
  }
  async function removeScript(id: string) {
    await deleteFavoriteScript(id).catch(() => {});
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Biblioteca"
        title="Tu memoria creativa"
        subtitle="Estilos visuales y guiones favoritos que el sistema reutiliza para sesgar las próximas generaciones."
        actions={
          <>
            <Link href="/profiles" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md" icon={Icon.Type}>Perfiles</Button>
            </Link>
            <Link href="/avatars" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md" icon={Icon.Mask}>Avatares</Button>
            </Link>
            <Button variant="primary" size="md" icon={Icon.Plus} glow onClick={() => setCreatorOpen(true)}>
              Nuevo estilo
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TabBtn active={tab === 'styles'} onClick={() => setTab('styles')} icon={Icon.Image}>
          Estilos visuales {styles.length > 0 && `(${styles.length})`}
        </TabBtn>
        <TabBtn active={tab === 'scripts'} onClick={() => setTab('scripts')} icon={Icon.Film}>
          Guiones favoritos {scripts.length > 0 && `(${scripts.length})`}
        </TabBtn>
      </div>

      {loading ? (
        <p style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Cargando…</p>
      ) : tab === 'styles' ? (
        styles.length === 0 ? (
          <EmptyState
            title="Sin estilos guardados"
            body="Creá uno con imágenes referenciales o guardá un look desde un carrusel terminado."
            action={<Button variant="primary" size="md" icon={Icon.Plus} onClick={() => setCreatorOpen(true)}>Nuevo estilo</Button>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {styles.map((s) => (
              <Card key={s.id} padding={0} style={{ overflow: 'hidden' }}>
                <div style={{ aspectRatio: '4 / 3', background: 'var(--bg-3)', position: 'relative' }}>
                  {s.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.thumbnailUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--fg-3)' }}>
                      <Icon.Image size={24} />
                    </div>
                  )}
                  <button onClick={() => void removeStyle(s.id)} title="Borrar estilo" style={trashBtn}>
                    <Icon.Trash size={12} />
                  </button>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  {s.styleNote && (
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0', lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>
                      {s.styleNote}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <Badge tone="default" size="sm">{s.references.length} refs</Badge>
                    <Badge tone="blue" size="sm">{s.stats.uses} usos</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : scripts.length === 0 ? (
        <EmptyState
          title="Sin guiones favoritos"
          body="Cuando apruebes un guion que te guste, tocá “Guardar en favoritos” en la revisión."
          action={<Link href="/scripts" style={{ textDecoration: 'none' }}><Button variant="primary" size="md" icon={Icon.Wand}>Ir a Scripts</Button></Link>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scripts.map((f) => (
            <Card key={f.id} padding={16}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)' }}>{f.name}</span>
                    {f.style && <Badge tone="blue" size="sm">{f.style.slice(0, 28)}</Badge>}
                    <Badge tone="default" size="sm">{f.sceneCount} escenas</Badge>
                    <Badge tone="default" size="sm">{f.stats.uses} usos</Badge>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0, lineHeight: 1.5, maxHeight: 44, overflow: 'hidden' }}>
                    {f.summary}
                  </p>
                  {f.thumbnails && f.thumbnails.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {f.thumbnails.slice(0, 8).map((url, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={`${f.id}-${i}`}
                          src={url}
                          alt={`escena ${i + 1}`}
                          style={{
                            width: 52,
                            height: 52,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" icon={Icon.Trash} onClick={() => void removeScript(f.id)} title="Borrar guion">
                  Borrar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <StyleCreatorModal
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={() => reload()}
      />
    </div>
  );
}

function TabBtn({ active, onClick, icon: I, children }: { active: boolean; onClick: () => void; icon: typeof Icon.Image; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? 'var(--blue-soft)' : 'var(--bg-2)',
        color: active ? 'var(--blue-hi)' : 'var(--fg-2)',
        border: `1px solid ${active ? 'var(--blue)' : 'var(--line)'}`,
      }}
    >
      <I size={15} /> {children}
    </button>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card padding={40}>
      <div style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--fg-1)' }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '8px 0 16px', lineHeight: 1.5 }}>{body}</p>
        {action}
      </div>
    </Card>
  );
}

const trashBtn: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 26,
  height: 26,
  borderRadius: 99,
  background: 'rgba(7,8,11,0.8)',
  color: 'var(--red-hi)',
  border: '1px solid var(--line-strong)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
};
