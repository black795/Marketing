'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  Spinner,
} from '../primitives';
import { useProject } from '../project-store';
import {
  streamRender,
  getLastRender,
  type RenderProgress,
  type RenderResult,
} from '@/lib/render-api';
import { StreamCancelledError } from '@/lib/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

function absolutize(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function ExportScreen() {
  const router = useRouter();
  const { script, scenes } = useProject();

  const [phase, setPhase] = useState<'idle' | 'render' | 'done'>('idle');
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (script === null) {
      router.replace('/scripts');
    }
  }, [script, router]);

  // Try to load any previously persisted render.
  useEffect(() => {
    if (!script) return;
    let cancelled = false;
    (async () => {
      try {
        const last = await getLastRender(script.projectId);
        if (!cancelled && last) {
          setResult(last);
          setPhase('done');
        }
      } catch {
        // ignore - no prior render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [script]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function startRender() {
    if (!script || phase === 'render') return;
    setPhase('render');
    setError(null);
    setProgress({ phase: 'connecting', message: 'Conectando con el render server...' });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const outcome = await streamRender(
        script.projectId,
        { burnCaptions },
        {
          onProgress: (p) => setProgress(p),
          onWarning: (msg) =>
            setProgress((prev) => (prev ? { ...prev, message: `! ${msg}` } : prev)),
        },
        abort.signal,
      );

      if (outcome.status === 'done') {
        setResult(outcome.render);
        setPhase('done');
      } else if (outcome.status === 'cancelled') {
        setError('Render cancelado.');
        setPhase('idle');
      } else {
        setError(outcome.error);
        setPhase('idle');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setError('Render cancelado.');
      } else {
        setError(err instanceof Error ? err.message : 'Render fallo');
      }
      setPhase('idle');
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  function cancelRender() {
    abortRef.current?.abort();
  }

  const firstScene = scenes?.find((s) => s.image_url);
  const previewUrl = result ? absolutize(result.url) : null;

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1300, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 07 - Export"
        title="Listo para publicar"
        subtitle="El render corre con ffmpeg + libass en el backend. Una vez listo podes bajar el MP4."
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <Card padding={0} style={{ overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              position: 'relative',
              background: '#000',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                width: 280,
                aspectRatio: '9 / 16',
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 24px 48px -16px rgba(0,0,0,0.8)',
                background: '#000',
              }}
            >
              {phase === 'done' && previewUrl ? (
                <video
                  src={previewUrl}
                  controls
                  loop
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : firstScene?.image_url ? (
                <img
                  src={firstScene.image_url}
                  alt="preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--fg-3)',
                    fontSize: 12,
                  }}
                >
                  sin preview
                </div>
              )}
              {phase === 'render' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(7,8,11,0.78)',
                    backdropFilter: 'blur(6px)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'center',
                      padding: 16,
                    }}
                  >
                    <Spinner size={28} color="var(--blue-hi)" />
                    <div
                      className="mono upper"
                      style={{ fontSize: 10, color: 'var(--blue-hi)', letterSpacing: 1.5 }}
                    >
                      {progress?.phase || 'preparing'}
                    </div>
                    <div style={{ fontSize: 12, color: '#fff' }}>
                      {progress?.message || 'Procesando...'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: 20, borderTop: '1px solid var(--line)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--fg-1)',
                  }}
                >
                  {script?.title || 'Proyecto sin titulo'}
                </h3>
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  {result
                    ? `${result.width}x${result.height} - ${result.fps}fps - ${result.durationSeconds.toFixed(1)}s`
                    : '9:16 - 1080p - render pendiente'}
                </div>
              </div>
              {phase === 'done' && (
                <Badge tone="success" icon={Icon.Check}>
                  Render OK
                </Badge>
              )}
            </div>

            {phase === 'render' && progress && (
              <ProgressBar value={progress.progress ?? null} label={progress.message} />
            )}

            {phase === 'idle' && (
              <Button
                variant="primary"
                size="lg"
                icon={Icon.Zap}
                onClick={startRender}
                glow
                style={{ width: '100%' }}
              >
                Renderizar video
              </Button>
            )}

            {phase === 'render' && (
              <Button
                variant="danger"
                size="md"
                icon={Icon.X}
                onClick={cancelRender}
                style={{ width: '100%' }}
              >
                Cancelar render
              </Button>
            )}

            {phase === 'done' && previewUrl && (
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={previewUrl}
                  download={`${script?.projectId ?? 'video'}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  <Button variant="primary" size="md" icon={Icon.Download} glow style={{ width: '100%' }}>
                    Bajar MP4
                  </Button>
                </a>
                <Button
                  variant="secondary"
                  size="md"
                  icon={Icon.Refresh}
                  onClick={() => {
                    setResult(null);
                    setPhase('idle');
                  }}
                >
                  Re-render
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
              Opciones de render
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={burnCaptions}
                onChange={(e) => setBurnCaptions(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
                  Burn-in captions
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                  Subtitulos quemados al video (vs SRT externo)
                </div>
              </div>
            </label>
          </Card>

          {result && (
            <Card padding={20}>
              <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
                Ultimo render
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <Row label="Clips" value={String(result.clipCount)} />
                <Row label="Duracion" value={`${result.durationSeconds.toFixed(2)}s`} />
                <Row label="Resolucion" value={`${result.width}x${result.height}`} />
                <Row label="FPS" value={String(result.fps)} />
                <Row label="Captions" value={result.burnedCaptions ? 'burn-in' : 'externo'} />
                <Row label="Cuando" value={new Date(result.renderedAt).toLocaleString()} />
              </div>
            </Card>
          )}

          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
              Acciones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button
                variant="outline"
                size="sm"
                icon={Icon.Edit}
                onClick={() => router.push('/timeline')}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Volver al timeline
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Icon.Plus}
                onClick={() => router.push('/')}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                Nuevo proyecto
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span className="mono" style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}
