'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, SectionHeader } from '../primitives';
import { STYLES_PRESETS, type StylePreset } from '../mock-data';
import { projectStore, useProject } from '../project-store';

export default function StylesScreen() {
  const router = useRouter();
  const { script, scenes, styleId } = useProject();
  const presets = STYLES_PRESETS;
  const sel = styleId || 'editorial-bright';
  const firstScene = scenes?.find((s) => s.image_url) || scenes?.[0];

  useEffect(() => {
    if (script === null) {
      router.replace('/scripts');
    } else if (scenes === null) {
      router.replace('/scripts/scenes');
    }
  }, [script, scenes, router]);

  function pick(id: string) {
    projectStore.setStyleId(id);
  }

  function continueToTimeline() {
    if (!styleId) projectStore.setStyleId(sel);
    router.push('/timeline');
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 05 - Estilo visual"
        title="Una direccion, todo el proyecto"
        subtitle="Aplica un estilo cohesivo en todas las escenas. La identidad de personaje se mantiene; cambia luz, paleta y textura."
        actions={
          <>
            <Button variant="secondary" size="md" icon={Icon.Plus}>
              Crear preset
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Icon.Arrow}
              onClick={continueToTimeline}
              glow
            >
              Aplicar y continuar
            </Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {presets.map((p) => (
            <StylePresetCard
              key={p.id}
              preset={p}
              selected={sel === p.id}
              onSelect={() => pick(p.id)}
            />
          ))}
        </div>

        <div style={{ position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                Preview - {presets.find((p) => p.id === sel)?.name || 'Sin estilo'}
              </span>
              <Badge tone="blue" dot size="sm">
                live
              </Badge>
            </div>
            <div style={{ aspectRatio: '9 / 16', background: '#000', position: 'relative' }}>
              {firstScene?.image_url ? (
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
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Sin imagenes generadas
                </div>
              )}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(presets.find((p) => p.id === sel)?.colors || []).map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: c,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, margin: 0 }}>
                {presets.find((p) => p.id === sel)?.description}
              </p>
            </div>
          </Card>

          <Card padding={16} style={{ marginTop: 12 }}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 12 }}>
              Ajustes finos
            </div>
            <p
              style={{
                fontSize: 11,
                color: 'var(--fg-3)',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              Ajustes per-scene se aplican en /timeline.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StylePresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: StylePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: 14,
        textAlign: 'left',
        borderRadius: 14,
        background: 'var(--bg-2)',
        border: `1.5px solid ${selected ? 'var(--blue)' : hover ? 'var(--line-strong)' : 'var(--line)'}`,
        boxShadow: selected
          ? '0 0 0 3px var(--blue-soft), var(--shadow-md)'
          : hover
            ? 'var(--shadow-md)'
            : 'var(--shadow-sm)',
        transition: 'all 220ms var(--ease-out)',
        cursor: 'pointer',
        transform: hover && !selected ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {selected && (
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 22,
            height: 22,
            borderRadius: 99,
            background: 'var(--blue)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 12px var(--blue-glow)',
          }}
        >
          <Icon.Check size={12} />
        </span>
      )}

      <div
        style={{
          display: 'flex',
          gap: 0,
          height: 56,
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {preset.colors.map((c, i) => (
          <div key={i} style={{ flex: 1, background: c }} />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            margin: 0,
            color: 'var(--fg-1)',
          }}
        >
          {preset.name}
        </h3>
        <Badge tone="default" size="sm">
          {preset.tag}
        </Badge>
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0, lineHeight: 1.5 }}>
        {preset.description}
      </p>
    </button>
  );
}
