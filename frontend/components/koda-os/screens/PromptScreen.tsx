'use client';

import React, { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, Kbd, SectionHeader } from '../primitives';
import { MODEL_OPTIONS } from '../mock-data';
import { projectStore, useProject } from '../project-store';
import { MentionTextarea } from '../MentionTextarea';
import { generateScript } from '@/lib/api';
import {
  SCENE_COUNT_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  type AspectRatioOption,
  type QualityProfile,
} from '@/lib/generation-settings';
import { useVoiceDictation } from '@/lib/voice/useVoiceDictation';

const REF_MAX = 10;
const REF_MAX_SIDE = 1280;
const SUPPORTED_REF_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

async function fileToResizedDataUrl(
  file: File,
  maxSide: number,
): Promise<{ dataUrl: string; bytes: number; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      el.src = objectUrl;
    });
    const longest = Math.max(img.width, img.height);
    const scale = longest > maxSide ? maxSide / longest : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    ctx.drawImage(img, 0, 0, w, h);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = mime === 'image/png' ? undefined : 0.9;
    const dataUrl = canvas.toDataURL(mime, quality);
    const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
    const bytes = Math.floor((base64Len * 3) / 4);
    return { dataUrl, bytes, width: w, height: h };
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

async function addRefFiles(files: FileList | null) {
  if (!files) return;
  const currentRefs = projectStore.get().form.references;
  const remaining = REF_MAX - currentRefs.length;
  const list = Array.from(files)
    .filter((f) => SUPPORTED_REF_MIMES.includes(f.type))
    .slice(0, Math.max(0, remaining));
  for (const file of list) {
    try {
      const { dataUrl, bytes, width, height } = await fileToResizedDataUrl(
        file,
        REF_MAX_SIDE,
      );
      const id = `ref-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      projectStore.setForm({
        references: [
          ...projectStore.get().form.references,
          { id, dataUrl, name: file.name, width, height, bytes },
        ],
      });
    } catch (err) {
      console.warn('[koda-os] no se pudo procesar referencia', file.name, err);
    }
  }
}

const chipBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 24,
  padding: '0 8px',
  borderRadius: 6,
  background: 'var(--bg-3)',
  border: '1px solid var(--line)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--fg-2)',
  cursor: 'pointer',
  transition: 'all 180ms',
  fontFamily: 'var(--font-mono)',
};

export default function PromptScreen() {
  const router = useRouter();
  const { form } = useProject();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileInputRef.current?.click();

  async function onGenerate() {
    if (generating) return;
    const visualPrompt = form.visualPrompt.trim();
    if (!visualPrompt) {
      setError('El prompt visual es requerido.');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const refDataUrls = form.references.map((r) => r.dataUrl);
      const script = await generateScript({
        visualPrompt,
        narrativePrompt: form.narrativePrompt.trim() || undefined,
        model: form.model,
        referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        sceneCount: form.settings.sceneCount,
      });
      projectStore.setScript(script);
      router.push('/scripts/review');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el guion. Revisa que el backend esté arriba.',
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 01 - Input"
        title="Defini tu historia"
        subtitle="Mientras mas especifico el prompt visual, mas se mantiene la identidad entre escenas. El narrativo es opcional pero ayuda con el arco."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card padding={24}>
            <PromptHeader
              letter="A"
              color="blue"
              title="Prompt visual"
              required
              hint="Estilo, personajes, escenas, composicion, ambiente."
            />
            <MentionTextarea
              value={form.visualPrompt}
              onChange={(v) => projectStore.setForm({ visualPrompt: v })}
              references={form.references}
              rows={5}
              ariaLabel="Referencias para el prompt visual"
              placeholder="Ej: editorial bright, mujer joven con outfit oversized en estudio de ceramica, luz natural lateral, paleta calida, textura iPhone candid... o menciona @imagen1 para anclar la identidad."
              style={{ minHeight: 120 }}
            />
            <PromptToolbar
              refCount={form.references.length}
              value={form.visualPrompt}
              onChange={(v) => projectStore.setForm({ visualPrompt: v })}
              onOpenRefs={openFilePicker}
            />
          </Card>

          <Card padding={24}>
            <PromptHeader
              letter="B"
              color="red"
              title="Prompt narrativo"
              hint="Historia, tono, arco emocional, mensaje."
            />
            <MentionTextarea
              value={form.narrativePrompt}
              onChange={(v) => projectStore.setForm({ narrativePrompt: v })}
              references={form.references}
              rows={4}
              ariaLabel="Referencias para el prompt narrativo"
              placeholder="Ej: arco de inseguridad - flow - orgullo. Podes mencionar referencias como '@imagen1 entra al estudio frustrada'..."
              style={{ minHeight: 96 }}
            />
            <PromptToolbar
              refCount={form.references.length}
              value={form.narrativePrompt}
              onChange={(v) => projectStore.setForm({ narrativePrompt: v })}
              onOpenRefs={openFilePicker}
            />
          </Card>

          <Card padding={24}>
            <ReferenceUploader />
          </Card>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_REF_MIMES.join(',')}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            addRefFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 24,
            alignSelf: 'flex-start',
          }}
        >
          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
              Modelo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => projectStore.setForm({ model: opt.value })}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: form.model === opt.value ? 'var(--blue-soft)' : 'var(--bg-1)',
                    border: `1px solid ${form.model === opt.value ? 'var(--blue-ring)' : 'var(--line)'}`,
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: form.model === opt.value ? 'var(--blue-hi)' : 'var(--fg-1)',
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <Badge tone={opt.badge === 'Recomendado' ? 'blue' : 'default'} size="sm">
                        {opt.badge}
                      </Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card padding={20}>
            <div className="mono upper" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
              Configuracion
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SliderControl
                label="Escenas"
                value={form.settings.sceneCount}
                onChange={(v) => projectStore.setSettings({ sceneCount: v })}
                options={SCENE_COUNT_OPTIONS.map((o) => o.value)}
                hint={`~${form.settings.sceneCount * 12}s de generacion - 1 escena cada 12s`}
              />
              <RadioRow
                label="Aspecto"
                value={form.settings.aspectRatio}
                onChange={(v) => projectStore.setSettings({ aspectRatio: v as AspectRatioOption })}
                options={ASPECT_RATIO_OPTIONS.slice(0, 3).map((o) => ({
                  v: o.value,
                  label: o.label,
                }))}
              />
              <RadioRow
                label="Calidad"
                value={form.settings.quality}
                onChange={(v) =>
                  projectStore.setSettings({ quality: v as QualityProfile })
                }
                options={[
                  { v: 'draft', label: 'Draft' },
                  { v: 'standard', label: 'Std' },
                  { v: 'high', label: 'High' },
                ]}
              />
            </div>
          </Card>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--red-soft)',
                border: '1px solid var(--red-ring)',
                color: 'var(--red-hi)',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            icon={Icon.Sparkles}
            onClick={onGenerate}
            loading={generating}
            disabled={!form.visualPrompt.trim()}
            glow
            style={{ width: '100%' }}
          >
            {generating ? 'Generando guion...' : 'Generar guion'}
          </Button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--fg-3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Kbd>{'⌘'}</Kbd> <Kbd>{'⏎'}</Kbd> para generar
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Reference uploader ----------
function ReferenceUploader() {
  const { form } = useProject();
  const refs = form.references;

  function removeRef(id: string) {
    projectStore.setForm({
      references: refs.filter((r) => r.id !== id),
    });
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Referencias del personaje
          </h3>
          <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '2px 0 0' }}>
            Tomas frontales, perfiles, expresiones. Mantiene al personaje consistente.
          </p>
        </div>
        <Badge tone="default">{refs.length} / {REF_MAX}</Badge>
      </div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--fg-3)',
          margin: '0 0 10px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Cada miniatura es <code>@imagen&lt;N&gt;</code> — usalo en el prompt para anclar la identidad.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 10,
        }}
      >
        {refs.map((r, idx) => (
          <div
            key={r.id}
            style={{
              position: 'relative',
              aspectRatio: '1',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1.5px solid var(--blue)',
              boxShadow: '0 0 0 3px var(--blue-soft)',
              background: 'var(--bg-1)',
            }}
            title={`@imagen${idx + 1}${r.name ? ` · ${r.name}` : ''}`}
          >
            <img
              src={r.dataUrl}
              alt={r.name || `reference ${idx + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'var(--blue)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              }}
            >
              @imagen{idx + 1}
            </span>
            <button
              onClick={() => removeRef(r.id)}
              title="Quitar"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 22,
                height: 22,
                borderRadius: 99,
                background: 'rgba(7,8,11,0.7)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <Icon.X size={11} />
            </button>
          </div>
        ))}
        {refs.length < REF_MAX && (
          <label
            style={{
              aspectRatio: '1',
              borderRadius: 10,
              border: '1.5px dashed var(--line-strong)',
              background: 'var(--bg-1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: 'var(--fg-3)',
              cursor: 'pointer',
              transition: 'all 200ms',
            }}
          >
            <input
              type="file"
              accept={SUPPORTED_REF_MIMES.join(',')}
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                addRefFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Icon.Plus size={18} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>SUBIR</span>
          </label>
        )}
      </div>
    </>
  );
}

function PromptHeader({
  letter,
  color,
  title,
  required,
  hint,
}: {
  letter: string;
  color: 'blue' | 'red';
  title: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  const c = color === 'blue' ? 'var(--blue)' : 'var(--red)';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: c,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
          }}
        >
          {letter}
        </span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, margin: 0 }}>
          {title} {required && <span style={{ color: c }}>*</span>}
        </h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0, paddingLeft: 32 }}>{hint}</p>
    </div>
  );
}

function PromptToolbar({
  refCount,
  value,
  onChange,
  onOpenRefs,
}: {
  refCount: number;
  value: string;
  onChange: (v: string) => void;
  onOpenRefs: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px dashed var(--line)',
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <VoiceChip value={value} onChange={onChange} />
        <button type="button" style={chipBtn} onClick={onOpenRefs} title="Subir referencias">
          <Icon.At size={12} /> {refCount} refs
        </button>
        <button type="button" style={{ ...chipBtn, opacity: 0.5, cursor: 'not-allowed' }} disabled title="Proximamente">
          <Icon.Sparkles size={12} /> Mejorar
        </button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        <Kbd>@</Kbd> menciona refs
      </span>
    </div>
  );
}

function VoiceChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dictation = useVoiceDictation({
    baseText: value,
    onText: (next) => onChange(next),
  });

  const isOn =
    dictation.status === 'listening' || dictation.status === 'processing';
  const isPaused = dictation.status === 'paused';
  const disabled =
    dictation.status === 'unsupported' || dictation.status === 'denied';

  const handleClick = () => {
    if (disabled) return;
    if (isOn) {
      dictation.stop();
    } else {
      dictation.reset(value);
      dictation.start();
    }
  };

  const label =
    dictation.status === 'unsupported'
      ? 'Sin soporte'
      : dictation.status === 'denied'
        ? 'Bloqueado'
        : dictation.status === 'processing'
          ? 'Iniciando...'
          : dictation.status === 'listening'
            ? 'Escuchando'
            : isPaused
              ? 'Pausado'
              : 'Voz';

  const tooltip =
    dictation.status === 'unsupported'
      ? 'Tu navegador no soporta dictado por voz (usa Chrome o Edge).'
      : dictation.status === 'denied'
        ? 'Permiso de microfono denegado. Habilitalo en el navegador.'
        : isOn
          ? 'Detener dictado'
          : 'Dictar por voz';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={tooltip}
      aria-pressed={isOn}
      style={{
        ...chipBtn,
        background: isOn
          ? 'var(--red, #ff2d8a)'
          : isPaused
            ? 'var(--yellow-soft, var(--bg-3))'
            : 'var(--bg-3)',
        color: isOn ? '#fff' : 'var(--fg-2)',
        borderColor: isOn ? 'var(--red, #ff2d8a)' : 'var(--line)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {isOn && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.35)',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        />
      )}
      <Icon.Mic size={12} /> {label}
    </button>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: number[];
  hint?: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>{label}</span>
        <span className="mono tnum" style={{ fontSize: 12, color: 'var(--blue-hi)', fontWeight: 700 }}>
          {value}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 4,
          background: 'var(--bg-1)',
          padding: 3,
          borderRadius: 8,
          border: '1px solid var(--line)',
        }}
      >
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              background: value === opt ? 'var(--bg-3)' : 'transparent',
              color: value === opt ? 'var(--fg-1)' : 'var(--fg-3)',
              boxShadow:
                value === opt
                  ? '0 0 0 1px var(--blue-ring), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : 'none',
              cursor: 'pointer',
              transition: 'all 180ms',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>
        {hint}
      </p>
    </div>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}>{label}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 6,
          background: 'var(--bg-1)',
          padding: 3,
          borderRadius: 8,
          border: '1px solid var(--line)',
        }}
      >
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              height: 28,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: value === o.v ? 'var(--bg-3)' : 'transparent',
              color: value === o.v ? 'var(--fg-1)' : 'var(--fg-3)',
              boxShadow:
                value === o.v
                  ? '0 0 0 1px var(--blue-ring), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : 'none',
              cursor: 'pointer',
              transition: 'all 180ms',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
