'use client';

import React from 'react';
import { Icon, type IconComponent } from '../icons';
import { Badge, Button, Card, ProgressBar, SectionHeader } from '../primitives';

type ApiStatus = 'ok' | 'warn' | 'missing';

export default function SettingsScreen() {
  return (
    <div style={{ padding: '32px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader
        kicker="Configuracion"
        title="API keys & sistema"
        subtitle="Las claves se guardan localmente. Cada proceso lee su propio .env."
      />

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <ApiRow
          label="Anthropic Claude"
          desc="Genera el guion + estructura de escenas"
          status="ok"
          sample="sk-ant-api03-***************************dE2A"
        />
        <ApiRow
          label="Replicate"
          desc="Genera imagenes por escena - burst=1"
          status="ok"
          sample="r8_*****************************42hQ"
        />
        <ApiRow label="ElevenLabs" desc="TTS para modo Avatar - opcional" status="ok" sample="*********************" />
        <ApiRow
          label="Higgsfield"
          desc="Lipsync - automatizacion browser - opcional"
          status="warn"
        />
        <ApiRow label="Krea" desc="Motion design 3D - opcional" status="missing" />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <Card padding={20}>
          <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
            Procesos locales
          </div>
          <ProcessRow name="Frontend" port={3000} />
          <ProcessRow name="Gateway" port={4000} />
          <ProcessRow name="Worker Python" port={5000} />
        </Card>

        <Card padding={20}>
          <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
            Cuenta Replicate
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Saldo</span>
            <span
              className="mono"
              style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 700 }}
            >
              $4.82 USD
            </span>
          </div>
          <ProgressBar value={0.32} label="Uso del limite mensual" />
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: 'var(--warning-soft)',
              border: '1px solid rgba(245,181,68,0.3)',
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--warning)',
            }}
          >
            ! Saldo &lt;$5 USD activa burst=1. El gateway hace retry automatico en 429.
          </div>
        </Card>
      </div>
    </div>
  );
}

function ApiRow({
  label,
  desc,
  status,
  sample,
}: {
  label: string;
  desc: string;
  status: ApiStatus;
  sample?: string;
}) {
  const cfg: Record<ApiStatus, { color: string; icon: IconComponent; text: string; tone: 'success' | 'warn' | 'red' }> = {
    ok: { color: 'var(--success)', icon: Icon.Check, text: 'Conectado', tone: 'success' },
    warn: { color: 'var(--warning)', icon: Icon.Clock, text: 'Pendiente', tone: 'warn' },
    missing: { color: 'var(--red)', icon: Icon.X, text: 'Falta', tone: 'red' },
  };
  const C = cfg[status];
  const StatusIcon = C.icon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${C.color}1F`,
          color: C.color,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <StatusIcon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{label}</span>
          <Badge tone={C.tone} size="sm">
            {C.text}
          </Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{desc}</div>
        {sample && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-3)',
              marginTop: 4,
              padding: '4px 8px',
              background: 'var(--bg-1)',
              borderRadius: 4,
              width: 'fit-content',
            }}
          >
            {sample}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" icon={Icon.Key}>
        {status === 'ok' ? 'Cambiar' : 'Conectar'}
      </Button>
    </div>
  );
}

function ProcessRow({ name, port }: { name: string; port: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px dashed var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="breath"
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: 'var(--success)',
            boxShadow: '0 0 6px var(--success)',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{name}</span>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
        :{port}
      </span>
    </div>
  );
}
