'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import {
  Badge,
  Button,
  Card,
  IconButton,
  SectionHeader,
} from '../primitives';
import { useProject } from '../project-store';
import { buildTimeline } from '@/lib/captions-api';
import type { Scene } from '@/types/story';
import type { IconComponent } from '../icons';

export default function TimelineScreen() {
  const router = useRouter();
  const { script, scenes } = useProject();
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(20);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (script === null) {
      router.replace('/scripts');
    } else if (scenes === null) {
      router.replace('/scripts/scenes');
    }
  }, [script, scenes, router]);

  const totalDur = (scenes ?? []).reduce((a, s) => a + (s.duration || 0), 0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        setPlayhead((p) => {
          const next = p + 0.1;
          return next >= totalDur ? 0 : next;
        }),
      100,
    );
    return () => clearInterval(id);
  }, [playing, totalDur]);

  if (!scenes || !script) {
    return (
      <div style={{ padding: 48, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        Cargando timeline...
      </div>
    );
  }

  let acc = 0;
  let currentSceneIdx = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (playhead < acc + (scenes[i].duration || 0)) {
      currentSceneIdx = i;
      break;
    }
    acc += scenes[i].duration || 0;
  }
  const currentScene = scenes[currentSceneIdx];

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${String(m).padStart(1, '0')}:${sec.padStart(4, '0')}`;
  }

  async function persistTimelineAndContinue() {
    if (!script || !scenes) return;
    setSavingTimeline(true);
    setError(null);
    try {
      await buildTimeline({
        projectId: script.projectId,
        title: script.title,
        source: 'scripts',
        respectOrder: true,
        scenes: scenes.map((s) => ({
          scene_number: s.scene_number,
          image_url: s.image_url ?? null,
          video_url: null,
          local_url: null,
          duration: s.duration,
          narration: s.narration,
        })),
      });
      router.push('/export');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el timeline',
      );
    } finally {
      setSavingTimeline(false);
    }
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 06 - Timeline"
        title="Componer el video"
        subtitle="El timeline.json se persiste al backend antes de renderizar. Render real usa ffmpeg + libass."
        actions={
          <>
            <Button
              variant="primary"
              size="md"
              icon={Icon.Arrow}
              onClick={persistTimelineAndContinue}
              loading={savingTimeline}
              glow
            >
              Render & Export
            </Button>
          </>
        }
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={0} style={{ overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'relative', background: '#000' }}>
              <div
                style={{
                  aspectRatio: '9 / 16',
                  maxHeight: 480,
                  margin: '0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#000',
                }}
              >
                {currentScene?.image_url ? (
                  <img
                    src={currentScene.image_url}
                    alt={currentScene.scene_title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>sin imagen</div>
                )}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 32,
                  transform: 'translateX(-50%)',
                  maxWidth: '80%',
                  padding: '8px 14px',
                  background: 'rgba(7,8,11,0.78)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              >
                {currentScene?.narration.slice(0, 80)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderTop: '1px solid var(--line)',
                background: 'var(--bg-2)',
              }}
            >
              <IconButton icon={Icon.ArrowL} size={32} onClick={() => setPlayhead(0)} />
              <button
                onClick={() => setPlaying((p) => !p)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 99,
                  background: 'linear-gradient(180deg, var(--blue-hi), var(--blue))',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--blue-lo)',
                  boxShadow: '0 0 16px var(--blue-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {playing ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
              </button>
              <IconButton icon={Icon.Arrow} size={32} onClick={() => setPlayhead(totalDur)} />

              <div
                className="mono tnum"
                style={{
                  fontSize: 13,
                  color: 'var(--fg-1)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {fmt(playhead)} <span style={{ color: 'var(--fg-3)' }}>/ {fmt(totalDur)}</span>
              </div>

              <div style={{ flex: 1 }} />

              {currentScene && (
                <Badge tone="default">
                  SC{String(currentScene.scene_number).padStart(2, '0')} - {currentScene.scene_title}
                </Badge>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-3)' }}>
                <Icon.Minus size={12} />
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: 80, accentColor: 'var(--blue)' }}
                />
                <Icon.Plus size={12} />
              </div>
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div
              style={{
                position: 'relative',
                height: 26,
                borderBottom: '1px solid var(--line)',
                background: 'var(--bg-1)',
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: Math.ceil(totalDur) + 1 }).map((_, i) => (
                <React.Fragment key={i}>
                  <div
                    style={{
                      position: 'absolute',
                      left: i * zoom,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: i % 5 === 0 ? 'var(--line-strong)' : 'var(--line)',
                    }}
                  />
                  {i % 5 === 0 && (
                    <span
                      className="mono tnum"
                      style={{
                        position: 'absolute',
                        left: i * zoom + 4,
                        top: 4,
                        fontSize: 10,
                        color: 'var(--fg-3)',
                      }}
                    >
                      {i}s
                    </span>
                  )}
                </React.Fragment>
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: playhead * zoom,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: 'var(--red)',
                  boxShadow: '0 0 8px var(--red-glow)',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    left: -6,
                    width: 14,
                    height: 14,
                    background: 'var(--red)',
                    clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  }}
                />
              </div>
            </div>

            <div style={{ position: 'relative', padding: '8px 0', background: 'var(--bg-1)' }}>
              <TrackRow label="Video" icon={Icon.Film} zoom={zoom} totalDur={totalDur}>
                {(() => {
                  let acc2 = 0;
                  return scenes.map((s) => {
                    const left = acc2 * zoom;
                    const width = (s.duration || 0) * zoom;
                    acc2 += s.duration || 0;
                    return <TimelineClip key={s.scene_number} left={left} width={width} scene={s} />;
                  });
                })()}
              </TrackRow>

              <TrackRow label="Captions" icon={Icon.Type} zoom={zoom} totalDur={totalDur}>
                {(() => {
                  let acc2 = 0;
                  return scenes.map((s) => {
                    const left = acc2 * zoom;
                    const width = (s.duration || 0) * zoom;
                    acc2 += s.duration || 0;
                    return (
                      <div
                        key={s.scene_number}
                        style={{
                          position: 'absolute',
                          left: left + 4,
                          top: 4,
                          height: 32,
                          width: Math.max(0, width - 8),
                          background: 'var(--red-soft)',
                          border: '1px solid var(--red-ring)',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          fontSize: 10,
                          color: 'var(--red-hi)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.narration.slice(0, 32)}...
                      </div>
                    );
                  });
                })()}
              </TrackRow>

              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 76 + playhead * zoom,
                  width: 2,
                  background: 'var(--red)',
                  boxShadow: '0 0 8px var(--red-glow)',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
              />
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
              Clip seleccionado
            </div>
            {currentScene && (
              <>
                <div
                  style={{
                    marginBottom: 12,
                    aspectRatio: '9 / 16',
                    background: 'var(--bg-3)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {currentScene.image_url ? (
                    <img
                      src={currentScene.image_url}
                      alt={currentScene.scene_title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--fg-1)' }}>
                  {currentScene.scene_title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
                  SC{String(currentScene.scene_number).padStart(2, '0')} - {currentScene.duration}s -{' '}
                  {currentSceneIdx + 1} de {scenes.length}
                </div>
              </>
            )}
          </Card>

          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
              Proyecto
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <Row label="Project ID" value={script.projectId.slice(0, 14) + '...'} />
              <Row label="Duracion" value={`${totalDur}s`} />
              <Row label="Escenas" value={String(scenes.length)} />
              <Row label="Captions" value="auto (burn-in)" />
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

function TrackRow({
  label,
  icon: I,
  children,
  totalDur,
  zoom,
}: {
  label: string;
  icon: IconComponent;
  children: React.ReactNode;
  totalDur: number;
  zoom: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: 40,
        position: 'relative',
        borderBottom: '1px solid var(--line-faint)',
      }}
    >
      <div
        style={{
          width: 76,
          flexShrink: 0,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-2)',
          borderRight: '1px solid var(--line)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--fg-2)',
        }}
      >
        <I size={12} /> {label}
      </div>
      <div style={{ position: 'relative', flex: 1, height: '100%', width: totalDur * zoom }}>
        {children}
      </div>
    </div>
  );
}

function TimelineClip({ left, width, scene }: { left: number; width: number; scene: Scene }) {
  return (
    <div
      title={scene.scene_title}
      style={{
        position: 'absolute',
        left: left + 2,
        top: 4,
        height: 32,
        width: Math.max(0, width - 4),
        background: scene.image_url
          ? `url(${scene.image_url}) center/cover`
          : 'var(--bg-3)',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 10,
        color: '#fff',
        fontWeight: 600,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        cursor: 'grab',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      <span style={{ marginRight: 6, opacity: 0.95, fontFamily: 'var(--font-mono)' }}>
        SC{String(scene.scene_number).padStart(2, '0')}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.scene_title}</span>
    </div>
  );
}
