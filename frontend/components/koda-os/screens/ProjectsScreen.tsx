'use client';

// Galería "Mis proyectos": lista los proyectos guardados, permite retomarlos
// (carga el snapshot al store y navega a la fase más avanzada) y borrarlos.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, SectionHeader } from '../primitives';
import { projectStore } from '../project-store';
import { fetchProjects, getProjectState, deleteProject, type ProjectMeta } from '@/lib/project-library';

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((reg) => setProjects(reg.projects))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los proyectos'))
      .finally(() => setLoading(false));
  }, []);

  function destFor(p: ProjectMeta): string {
    if (p.hasVideo) return '/storyboard';
    if (p.hasImages) return '/scripts/scenes';
    if (p.hasScript) return '/scripts/review';
    return '/scripts';
  }

  async function open(p: ProjectMeta) {
    setBusyId(p.id);
    setError(null);
    try {
      const state = await getProjectState(p.id);
      projectStore.loadProject({ ...state, savedProjectId: p.id });
      router.push(destFor(p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el proyecto');
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    await deleteProject(id).catch(() => {});
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Mis proyectos"
        title="Retomá donde lo dejaste"
        subtitle="Tus guiones, imágenes y configuraciones guardadas. Abrí uno para seguir editándolo."
        actions={
          <Button variant="primary" size="md" icon={Icon.Plus} glow onClick={() => { projectStore.reset(); router.push('/scripts'); }}>
            Nuevo proyecto
          </Button>
        }
      />

      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red-ring)', color: 'var(--red-hi)', fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Cargando…</p>
      ) : projects.length === 0 ? (
        <Card padding={40}>
          <div style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--fg-1)' }}>Todavía no guardaste proyectos</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '8px 0 16px', lineHeight: 1.5 }}>
              Generá un guion y tocá “Guardar proyecto” para poder retomarlo desde acá.
            </p>
            <Button variant="primary" size="md" icon={Icon.Wand} onClick={() => router.push('/scripts')}>Ir a Scripts</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {projects.map((p) => (
            <Card key={p.id} padding={0} hover style={{ overflow: 'hidden' }}>
              <button
                onClick={() => void open(p)}
                disabled={busyId === p.id}
                style={{ width: '100%', textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ aspectRatio: '16 / 10', background: 'var(--bg-3)', position: 'relative' }}>
                  {p.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.thumbnailUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--fg-3)' }}>
                      <Icon.Film size={26} />
                    </div>
                  )}
                  {busyId === p.id && (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(7,8,11,0.5)', color: 'var(--blue-hi)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      Abriendo…
                    </div>
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  {p.promptPreview && (
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0', lineHeight: 1.4, maxHeight: 30, overflow: 'hidden' }}>
                      {p.promptPreview}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <Badge tone="default" size="sm">{p.sceneCount} escenas</Badge>
                    {p.hasVideo ? <Badge tone="blue" size="sm">video</Badge> : p.hasImages ? <Badge tone="blue" size="sm">imágenes</Badge> : p.hasScript ? <Badge tone="default" size="sm">guion</Badge> : null}
                  </div>
                </div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 10px' }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
                <button onClick={() => void remove(p.id)} title="Borrar proyecto" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <Icon.Trash size={12} /> borrar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
