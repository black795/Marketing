'use client';

// Tim Koda OS - Shared UI primitives
import React, { useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconComponent } from './icons';
import { SCENE_IMAGES } from './mock-data';

// ---------- Spinner ----------
export function Spinner({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'koda-spin 0.9s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.18" strokeWidth="2.5" fill="none" />
      <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ---------- Button ----------
type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  iconRight?: IconComponent;
  loading?: boolean;
  glow?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: IconCmp,
  iconRight: IconRight,
  loading = false,
  glow = false,
  children,
  className = '',
  style,
  disabled,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const sz = {
    sm: { h: 28, px: 10, fs: 12, gap: 6, ic: 13 },
    md: { h: 36, px: 14, fs: 13, gap: 8, ic: 15 },
    lg: { h: 44, px: 18, fs: 14, gap: 10, ic: 17 },
  }[size];

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, var(--blue-hi) 0%, var(--blue) 60%, var(--blue-lo) 100%)',
      color: '#FFFFFF',
      border: '1px solid var(--blue-lo)',
      boxShadow: glow
        ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px var(--blue-ring), 0 8px 24px -6px var(--blue-glow)'
        : 'inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)',
    },
    danger: {
      background: 'linear-gradient(180deg, var(--red-hi) 0%, var(--red) 60%, var(--red-lo) 100%)',
      color: '#FFFFFF',
      border: '1px solid var(--red-lo)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)',
    },
    secondary: {
      background: 'var(--bg-3)',
      color: 'var(--fg-1)',
      border: '1px solid var(--line-strong)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--fg-2)',
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: 'var(--fg-1)',
      border: '1px solid var(--line-strong)',
    },
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`focus-ring ${className}`}
      style={{
        height: sz.h,
        padding: `0 ${sz.px}px`,
        fontSize: sz.fs,
        gap: sz.gap,
        fontWeight: 600,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 120ms var(--ease-out), filter 180ms, box-shadow 220ms, background 220ms',
        ...variants[variant],
        ...(style || {}),
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(1px)';
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = '';
        onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        onMouseLeave?.(e);
      }}
    >
      {loading ? <Spinner size={sz.ic} /> : IconCmp ? <IconCmp size={sz.ic} /> : null}
      {children}
      {IconRight && <IconRight size={sz.ic} />}
    </button>
  );
}

// ---------- IconButton ----------
type IconButtonTone = 'default' | 'blue' | 'red';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconComponent;
  size?: number;
  tone?: IconButtonTone;
  active?: boolean;
}

export function IconButton({
  icon: IconCmp,
  size = 32,
  tone = 'default',
  active = false,
  className = '',
  style,
  ...rest
}: IconButtonProps) {
  const tones: Record<IconButtonTone, { bg: string; color: string; border: string; hoverBg: string; hoverColor: string }> = {
    default: { bg: 'transparent', color: 'var(--fg-2)', border: 'var(--line)', hoverBg: 'var(--bg-3)', hoverColor: 'var(--fg-1)' },
    blue: { bg: 'var(--blue-soft)', color: 'var(--blue-hi)', border: 'var(--blue-ring)', hoverBg: 'var(--blue-soft)', hoverColor: 'var(--blue-hi)' },
    red: { bg: 'var(--red-soft)', color: 'var(--red-hi)', border: 'var(--red-ring)', hoverBg: 'var(--red-soft)', hoverColor: 'var(--red-hi)' },
  };
  const t = tones[tone];
  const [hover, setHover] = useState(false);

  return (
    <button
      {...rest}
      className={`focus-ring ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: size,
        width: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background: active || hover ? t.hoverBg : t.bg,
        color: active || hover ? t.hoverColor : t.color,
        border: `1px solid ${active ? t.border : 'transparent'}`,
        transition: 'all 180ms var(--ease-out)',
        cursor: 'pointer',
        ...style,
      }}
    >
      <IconCmp size={Math.round(size * 0.5)} />
    </button>
  );
}

// ---------- Card ----------
export function Card({
  children,
  padding = 20,
  className = '',
  style,
  hover = false,
  accent = null,
}: {
  children?: ReactNode;
  padding?: number;
  className?: string;
  style?: CSSProperties;
  hover?: boolean;
  accent?: 'blue' | 'red' | null;
}) {
  return (
    <div
      className={`${hover ? 'lift' : ''} ${className}`}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding,
        position: 'relative',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      {accent && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            pointerEvents: 'none',
            boxShadow: accent === 'blue' ? '0 0 0 1px var(--blue-ring) inset' : '0 0 0 1px var(--red-ring) inset',
          }}
        />
      )}
      {children}
    </div>
  );
}

// ---------- Badge ----------
type BadgeTone = 'default' | 'blue' | 'red' | 'success' | 'warn' | 'solid';

export function Badge({
  children,
  tone = 'default',
  icon: IconCmp,
  dot = false,
  size = 'md',
}: {
  children?: ReactNode;
  tone?: BadgeTone;
  icon?: IconComponent;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const tones: Record<BadgeTone, { bg: string; color: string; border: string }> = {
    default: { bg: 'var(--bg-3)', color: 'var(--fg-2)', border: 'var(--line)' },
    blue: { bg: 'var(--blue-soft)', color: 'var(--blue-hi)', border: 'var(--blue-ring)' },
    red: { bg: 'var(--red-soft)', color: 'var(--red-hi)', border: 'var(--red-ring)' },
    success: { bg: 'var(--success-soft)', color: 'var(--success)', border: 'rgba(43,212,164,0.3)' },
    warn: { bg: 'var(--warning-soft)', color: 'var(--warning)', border: 'rgba(245,181,68,0.3)' },
    solid: { bg: 'var(--fg-1)', color: 'var(--bg-0)', border: 'var(--fg-1)' },
  };
  const t = tones[tone];
  const sz = size === 'sm' ? { h: 18, fs: 10, px: 6 } : { h: 22, fs: 11, px: 8 };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: sz.h,
        padding: `0 ${sz.px}px`,
        borderRadius: 999,
        fontSize: sz.fs,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {dot && (
        <span
          className="breath"
          style={{ width: 6, height: 6, borderRadius: 99, background: t.color, display: 'inline-block' }}
        />
      )}
      {IconCmp && <IconCmp size={11} />}
      {children}
    </span>
  );
}

// ---------- Input ----------
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  icon?: IconComponent;
  suffix?: ReactNode;
  error?: boolean;
}

export function Input({ label, hint, icon: IconCmp, suffix, error, onFocus, onBlur, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-1)',
          border: `1px solid ${error ? 'var(--red)' : focused ? 'var(--blue)' : 'var(--line)'}`,
          borderRadius: 8,
          padding: '0 10px',
          boxShadow: focused ? '0 0 0 3px var(--blue-soft)' : 'none',
          transition: 'all 180ms var(--ease-out)',
        }}
      >
        {IconCmp && <IconCmp size={14} />}
        <input
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            height: 36,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--fg-1)',
            ...(style || {}),
          }}
        />
        {suffix}
      </div>
      {hint && <span style={{ fontSize: 11, color: error ? 'var(--red-hi)' : 'var(--fg-3)' }}>{hint}</span>}
    </div>
  );
}

// ---------- Textarea ----------
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'> {
  label?: ReactNode;
  hint?: ReactNode;
  labelPrefix?: ReactNode;
}

export function Textarea({ label, hint, labelPrefix, onFocus, onBlur, style, ...rest }: TextareaProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {labelPrefix}
            {label}
          </label>
          {hint && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{hint}</span>}
        </div>
      )}
      <textarea
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          background: 'var(--bg-1)',
          border: `1px solid ${focused ? 'var(--blue)' : 'var(--line)'}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--fg-1)',
          outline: 'none',
          resize: 'vertical',
          boxShadow: focused ? '0 0 0 3px var(--blue-soft)' : 'none',
          transition: 'all 180ms var(--ease-out)',
          lineHeight: 1.55,
          fontFamily: 'var(--font-body)',
          ...(style || {}),
        }}
      />
    </div>
  );
}

// ---------- Kbd ----------
export function Kbd({ children }: { children?: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

// ---------- SectionHeader ----------
export function SectionHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div>
        {kicker && (
          <div
            className="mono upper"
            style={{
              fontSize: 11,
              color: 'var(--blue-hi)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 20, height: 1, background: 'var(--blue)' }} />
            {kicker}
          </div>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--fg-1)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {subtitle && <p style={{ marginTop: 8, fontSize: 14, color: 'var(--fg-2)', maxWidth: 560 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ---------- ProgressBar ----------
export function ProgressBar({ value = null, label = null }: { value?: number | null; label?: ReactNode | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--fg-2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>{label}</span>
          {value !== null && <span className="tnum">{Math.round(value * 100)}%</span>}
        </div>
      )}
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
        {value === null ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, var(--blue) 50%, transparent)',
              backgroundSize: '40% 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'koda-slide 1.4s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              width: `${value * 100}%`,
              background: 'linear-gradient(90deg, var(--blue), var(--blue-hi))',
              transition: 'width 240ms var(--ease-out)',
              boxShadow: '0 0 12px var(--blue-glow)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------- SceneImage ----------
export function SceneImage({
  image,
  sceneNumber,
  aspectRatio = '9 / 16',
  small = false,
}: {
  image: string | null;
  sceneNumber?: number | null;
  sceneTitle?: string;
  aspectRatio?: string;
  small?: boolean;
}) {
  const meta = image ? SCENE_IMAGES[image] : undefined;
  if (!meta) {
    return (
      <div
        className="dot-grid"
        style={{
          background: 'var(--bg-3)',
          aspectRatio,
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--fg-3)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}
      >
        pending
      </div>
    );
  }
  return (
    <div
      style={{
        aspectRatio,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(${130 + meta.hue}deg,
          hsl(${meta.hue}, 35%, 18%) 0%,
          hsl(${meta.hue}, 55%, 32%) 45%,
          hsl(${(meta.hue + 30) % 360}, 60%, 58%) 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '60%',
          width: '80%',
          height: '80%',
          background: `radial-gradient(circle, hsl(${meta.hue}, 95%, 80%) 0%, transparent 55%)`,
          opacity: 0.55,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '12%',
          bottom: 0,
          width: '55%',
          height: '78%',
          background: `linear-gradient(180deg, hsla(${meta.hue}, 30%, 12%, 0.0) 0%, hsla(${meta.hue}, 40%, 10%, 0.8) 70%)`,
          borderRadius: '120px 80px 0 0',
          filter: 'blur(0.5px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: small ? 0 : 0.15,
          backgroundImage:
            'linear-gradient(transparent calc(33.33% - 0.5px), rgba(255,255,255,0.6) 33.33%, transparent calc(33.33% + 0.5px)),linear-gradient(transparent calc(66.66% - 0.5px), rgba(255,255,255,0.6) 66.66%, transparent calc(66.66% + 0.5px)),linear-gradient(90deg, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.6) 33.33%, transparent calc(33.33% + 0.5px)),linear-gradient(90deg, transparent calc(66.66% - 0.5px), rgba(255,255,255,0.6) 66.66%, transparent calc(66.66% + 0.5px))',
        }}
      />
      {!small && sceneNumber != null && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '4px 10px',
            background: 'rgba(7,8,11,0.78)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          SC - {String(sceneNumber).padStart(2, '0')}
        </div>
      )}
      {!small && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            padding: '3px 8px',
            background: 'rgba(7,8,11,0.78)',
            backdropFilter: 'blur(8px)',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          {meta.label} - 9:16
        </div>
      )}
    </div>
  );
}

// ---------- CharAvatar ----------
export function CharAvatar({ name, size = 28, hue = 220 }: { name: string; size?: number; hue?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: `linear-gradient(135deg, hsl(${hue},60%,55%), hsl(${(hue + 40) % 360},65%,45%))`,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontSize: size * 0.4,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {initials}
    </div>
  );
}

// ---------- FieldGroup helper ----------
export function FieldGroup({
  letter,
  color,
  title,
  children,
}: {
  letter: string;
  color: 'blue' | 'red';
  title: ReactNode;
  children?: ReactNode;
}) {
  const c = color === 'blue' ? 'var(--blue)' : 'var(--red)';
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: c,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
          }}
        >
          {letter}
        </span>
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {title}
        </span>
      </div>
      <div style={{ paddingLeft: 24 }}>{children}</div>
    </div>
  );
}

// re-export Icon for convenience
export { Icon };
