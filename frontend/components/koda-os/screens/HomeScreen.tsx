'use client';

import React, { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '../icons';
import { Badge } from '../primitives';
import type { IconComponent } from '../icons';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <div
      className="koda-os-root"
      style={{ minHeight: '100vh', background: 'var(--bg-0)', overflowY: 'auto' }}
    >
      <div style={{ padding: '48px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="anim-fade-up" style={{ marginBottom: 48 }}>
          <div
            className="mono upper"
            style={{
              fontSize: 11,
              color: 'var(--blue-hi)',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 24, height: 1, background: 'var(--blue)' }} />
            v1.0 - Tim Koda Creative OS
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 56,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.02,
              color: 'var(--fg-1)',
            }}
          >
            Hace contenido{' '}
            <span className="grad-blue-red" style={{ fontWeight: 700 }}>
              visual
            </span>
            <br />
            de principio a fin.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--fg-2)', maxWidth: 560, marginTop: 16, lineHeight: 1.55 }}>
            Prompt - guion cinematografico con escenas + imagenes - revision - video. Mantene identidad de personaje
            con referencias canonicas.
          </p>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}
          className="anim-fade-up"
        >
          <ModeCard
            accent="red"
            badge="Nuevo"
            number="01"
            icon={Icon.Mask}
            title="Avatar"
            description="Da vida a un retrato. Desde una imagen nueva o un avatar guardado, habla tu guion con voz IA o tu audio. Video lipsync listo para Reels."
            bullets={['Desde una imagen o un avatar guardado', 'Guion TTS o audio propio', 'Render 720p / 1080p - 9:16']}
            time="~90s render"
            onClick={() => router.push('/avatar')}
          />
          <ModeCard
            accent="red"
            number="02"
            icon={Icon.Plus}
            title="Crear avatar"
            description="Guarda tus personajes una vez: sube sus imágenes, define voz y atributos, y reutilizalos en cada video. Tu base de datos de avatares."
            bullets={['Varias imagenes por personaje', 'Voz, idioma y persona', 'Reutilizable en Avatar y Scripts']}
            time="Tu biblioteca"
            onClick={() => router.push('/avatars')}
          />
          <ModeCard
            accent="blue"
            number="03"
            icon={Icon.Film}
            title="Scripts & Referencias"
            description="El flujo completo: guion con Claude - revision - imagenes por escena - storyboard - video."
            bullets={[
              'Claude escribe el guion',
              'Imagenes por escena con Replicate',
              'Identidad consistente entre escenas',
            ]}
            time="~2-3 min - 5 escenas"
            recommended
            onClick={() => router.push('/scripts')}
          />
          <ModeCard
            accent="red"
            number="04"
            icon={Icon.Edit}
            title="Edicion"
            description="Arma un video con tus propios clips o con los videos generados en la fase de Scripts. Subtitulos y estilos al final."
            bullets={[
              'Subi tus videos o imagenes',
              'Importa videos de un proyecto previo',
              'Timeline + subtitulos dinamicos',
            ]}
            time="Sin render IA"
            onClick={() => router.push('/editor/manual')}
          />
        </div>

        <div
          className="anim-fade-up"
          style={{
            marginTop: 48,
            padding: '16px 20px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <StatusDot label="Worker - 5000" color="var(--success)" />
          <StatusDot label="Gateway - 4000" color="var(--success)" />
          <StatusDot label="Frontend - 3000" color="var(--success)" />
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            Replicate - $4.82 USD - burst=1
          </span>
          <Link href="/settings" style={{ textDecoration: 'none' }}>
            <Badge tone="blue" icon={Icon.Settings}>
              Cambiar
            </Badge>
          </Link>
        </div>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            fontSize: 12,
            color: 'var(--fg-3)',
          }}
        >
          <Link href="/avatars" style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>
            Mis avatares
          </Link>
          <Link href="/profiles" style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>
            Perfiles
          </Link>
          <Link href="/editor" style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>
            Editores (Remotion - Captions)
          </Link>
          <Link href="/settings" style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>
            Configuracion
          </Link>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  accent,
  number,
  icon: I,
  title,
  description,
  bullets,
  time,
  badge,
  recommended,
  onClick,
}: {
  accent: 'red' | 'blue';
  number: string;
  icon: IconComponent;
  title: string;
  description: string;
  bullets: string[];
  time: string;
  badge?: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const accentVar = accent === 'red' ? 'var(--red)' : 'var(--blue)';
  const glowVar = accent === 'red' ? 'var(--red-glow)' : 'var(--blue-glow)';
  const ringVar = accent === 'red' ? 'var(--red-ring)' : 'var(--blue-ring)';
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 28,
        position: 'relative',
        background: 'var(--bg-2)',
        border: `1px solid ${hover ? ringVar : 'var(--line)'}`,
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'all 300ms var(--ease-out)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hover ? `0 24px 48px -16px ${glowVar}` : 'var(--shadow-sm)',
        cursor: 'pointer',
        minHeight: 360,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -20,
          top: -30,
          fontSize: 240,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--bg-3)',
          lineHeight: 1,
          pointerEvents: 'none',
          opacity: hover ? 0.4 : 0.25,
          transition: 'opacity 300ms',
        }}
      >
        {number}
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: accent === 'red' ? 'var(--red-soft)' : 'var(--blue-soft)',
              border: `1px solid ${ringVar}`,
              display: 'grid',
              placeItems: 'center',
              color: accentVar,
              boxShadow: hover ? `0 0 24px ${glowVar}` : 'none',
              transition: 'box-shadow 300ms',
            }}
          >
            <I size={24} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {recommended && <Badge tone="blue">Recomendado</Badge>}
            {badge && <Badge tone="red">{badge}</Badge>}
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--fg-1)',
          }}
        >
          {title}
        </h2>
        <p style={{ marginTop: 10, color: 'var(--fg-2)', fontSize: 14, lineHeight: 1.55, marginBottom: 0 }}>
          {description}
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: 20,
            marginBottom: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {bullets.map((b) => (
            <li
              key={b}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--fg-2)' }}
            >
              <span style={{ width: 4, height: 4, borderRadius: 99, background: accentVar }} />
              {b}
            </li>
          ))}
        </ul>

        <div style={{ flex: 1, minHeight: 24 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 20,
            marginTop: 20,
            borderTop: '1px dashed var(--line)',
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {time}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: accentVar,
              transform: hover ? 'translateX(4px)' : 'translateX(0)',
              transition: 'transform 200ms',
            }}
          >
            Empezar <Icon.Arrow size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        className="breath"
        style={{ width: 8, height: 8, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        {label}
      </span>
    </div>
  );
}
