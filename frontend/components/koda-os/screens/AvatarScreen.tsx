'use client';

import React, { type CSSProperties, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconComponent } from '../icons';
import { Badge, Button, Card, ProgressBar, SectionHeader, Spinner, Textarea } from '../primitives';
import { streamGenerateAvatar, StreamCancelledError } from '@/lib/api';
import {
  AVATAR_DEFAULTS,
  AVATAR_LANGUAGES,
  AVATAR_MODELS,
  AVATAR_RESOLUTIONS,
  AVATAR_VOICES,
  SCRIPT_EXAMPLES,
  validateAvatarRequest,
} from '@/lib/avatar';
import type {
  AvatarModel,
  AvatarPhase,
  AvatarResolution,
  AvatarResult,
  AvatarVoiceMode,
} from '@/types/avatar';
import AvatarPicker from '@/components/avatar/AvatarPicker';
import { markAvatarUsed } from '@/lib/avatar-registry';
import type { Avatar } from '@/types/avatar-registry';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

function absolutize(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--fg-1)',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
};

type ImageCandidate = {
  id: string;
  dataUrl: string;
  name: string;
};

export default function AvatarScreen() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<AvatarVoiceMode>('tts');
  const [model, setModel] = useState<AvatarModel>('p_video_avatar');
  const [resolution, setResolution] = useState<AvatarResolution>('1080p');
  const [voice, setVoice] = useState(AVATAR_DEFAULTS.voice);
  const [voiceLanguage, setVoiceLanguage] = useState(AVATAR_DEFAULTS.voiceLanguage);
  const [voiceScript, setVoiceScript] = useState(SCRIPT_EXAMPLES[0].text);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const [phase, setPhase] = useState<AvatarPhase>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  function addImages(files: FileList | null) {
    if (!files) return;
    const remaining = 6 - candidates.length;
    const list = Array.from(files).slice(0, Math.max(0, remaining));
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl) return;
        const id = `img-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
        const candidate = { id, dataUrl, name: file.name };
        setCandidates((prev) => [...prev, candidate]);
        if (!selectedId) setSelectedId(id);
      };
      reader.readAsDataURL(file);
    });
  }

  function loadAudio(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      setAudioDataUrl(dataUrl);
      setAudioName(file.name);
    };
    reader.readAsDataURL(file);
  }

  // Carga un avatar guardado al formulario: su imagen, voz, idioma y resolución.
  function pickAvatar(avatar: Avatar) {
    const id = avatar.identity;
    const imgUrl = absolutize(id.primaryImageUrl);
    const candId = `avatar-${avatar.id}`;
    setCandidates((prev) => {
      const without = prev.filter((c) => c.id !== candId);
      return [{ id: candId, dataUrl: imgUrl, name: avatar.name }, ...without];
    });
    setSelectedId(candId);
    setVoice(id.voice);
    setVoiceLanguage(id.voiceLanguage);
    setResolution(id.resolution as AvatarResolution);
    setVoiceMode('tts');
    // telemetría (no bloquea la UI si falla)
    markAvatarUsed(avatar.id).catch(() => {});
  }

  const selectedImage = candidates.find((c) => c.id === selectedId);
  const isStreaming = phase !== 'idle' && phase !== 'completed' && phase !== 'failed';

  async function generate() {
    setError(null);
    setValidationErrors([]);

    const req = {
      image: selectedImage?.dataUrl,
      resolution,
      voiceMode,
      voiceScript: voiceMode === 'tts' ? voiceScript : undefined,
      voice: voiceMode === 'tts' ? voice : undefined,
      voiceLanguage: voiceMode === 'tts' ? voiceLanguage : undefined,
      audio: voiceMode === 'audio' ? audioDataUrl || undefined : undefined,
    };
    const v = validateAvatarRequest(req);
    if (!v.ok) {
      setValidationErrors(v.errors);
      return;
    }

    setResult(null);
    setPhase('connecting');
    setStatusMsg('Conectando con el worker...');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const outcome = await streamGenerateAvatar(
        {
          // OmniHuman solo aplica en modo audio; en TTS forzamos el estándar.
          model: voiceMode === 'audio' ? model : 'p_video_avatar',
          image: selectedImage!.dataUrl,
          resolution,
          ...(voiceMode === 'audio' && audioDataUrl
            ? { audio: audioDataUrl }
            : {
                voiceScript,
                voice,
                voiceLanguage,
                voicePrompt: AVATAR_DEFAULTS.voicePrompt,
                videoPrompt: AVATAR_DEFAULTS.videoPrompt,
              }),
        },
        {
          onStart: () => {
            setPhase('queued');
            setStatusMsg('Encolado en Replicate...');
          },
          onStatus: ({ phase: p, message }) => {
            setPhase(p);
            setStatusMsg(message);
          },
        },
        abort.signal,
      );

      if (outcome.status === 'completed') {
        setResult(outcome.result);
        setPhase('completed');
        setStatusMsg('Listo');
      } else if (outcome.status === 'failed') {
        setError(outcome.error);
        setPhase('failed');
      } else {
        setError('Generacion cancelada.');
        setPhase('idle');
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setError('Generacion cancelada.');
      } else {
        setError(err instanceof Error ? err.message : 'Generacion fallo');
      }
      setPhase('idle');
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const previewUrl = result ? absolutize(result.localUrl || result.videoUrl) : null;

  return (
    <div className="koda-os-root" style={{ minHeight: '100vh', background: 'var(--bg-0)', overflowY: 'auto' }}>
      <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--fg-3)',
            cursor: 'pointer',
            marginBottom: 12,
            background: 'transparent',
            border: 'none',
          }}
        >
          <Icon.ArrowL size={12} /> Cambiar tipo de generacion
        </button>

        <SectionHeader
          kicker="Modo - Avatar"
          title={
            <>
              Da vida a un retrato <span className="grad-blue-red">con voz</span>
            </>
          }
          subtitle="Subi una imagen, defini que dice y obtene un video lipsync en 9:16. prunaai/p-video-avatar."
        />

        {(error || validationErrors.length > 0) && (
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
            {error ||
              (validationErrors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AvatarPicker onPick={pickAvatar} />

            <Card padding={24}>
              <StepHeader
                num={1}
                title="Imagen del avatar"
                hint="El retrato que cobrara vida. Tomas frontales funcionan mejor."
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  marginTop: 16,
                }}
              >
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: `2px solid ${selectedId === c.id ? 'var(--red)' : 'var(--line)'}`,
                      background: 'var(--bg-1)',
                      cursor: 'pointer',
                      transition: 'all 200ms',
                      boxShadow: selectedId === c.id ? '0 0 0 3px var(--red-soft)' : 'none',
                    }}
                  >
                    <img
                      src={c.dataUrl}
                      alt={c.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {selectedId === c.id && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          width: 18,
                          height: 18,
                          borderRadius: 99,
                          background: 'var(--red)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Icon.Check size={11} />
                      </span>
                    )}
                  </button>
                ))}
                {candidates.length < 6 && (
                  <label
                    style={{
                      aspectRatio: '1',
                      borderRadius: 10,
                      border: '2px dashed var(--line-strong)',
                      background: 'var(--bg-1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      color: 'var(--fg-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => addImages(e.target.files)}
                    />
                    <Icon.Upload size={16} />
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>SUBIR</span>
                  </label>
                )}
              </div>
            </Card>

            <Card padding={24}>
              <StepHeader num={2} title="Voz y guion" hint="Que dice el avatar y como lo dice." />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  marginTop: 16,
                  marginBottom: 14,
                }}
              >
                <ModeTab
                  icon={Icon.Type}
                  label="Texto + IA"
                  sub="TTS - Gemini"
                  active={voiceMode === 'tts'}
                  onClick={() => setVoiceMode('tts')}
                  accent="red"
                />
                <ModeTab
                  icon={Icon.Mic}
                  label="Audio propio"
                  sub="MP3 / WAV"
                  active={voiceMode === 'audio'}
                  onClick={() => setVoiceMode('audio')}
                  accent="red"
                />
              </div>
              {voiceMode === 'tts' ? (
                <>
                  <Textarea
                    rows={4}
                    value={voiceScript}
                    onChange={(e) => setVoiceScript(e.target.value)}
                    style={{ minHeight: 96 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {SCRIPT_EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        onClick={() => setVoiceScript(ex.text)}
                        style={{
                          fontSize: 11,
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-3)',
                          border: '1px solid var(--line)',
                          color: 'var(--fg-2)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--fg-3)',
                          marginBottom: 6,
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}
                      >
                        Voz
                      </div>
                      <select style={selectStyle} value={voice} onChange={(e) => setVoice(e.target.value)}>
                        {AVATAR_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--fg-3)',
                          marginBottom: 6,
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}
                      >
                        Idioma
                      </div>
                      <select
                        style={selectStyle}
                        value={voiceLanguage}
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                      >
                        {AVATAR_LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <label
                  style={{
                    padding: 24,
                    borderRadius: 10,
                    border: '2px dashed var(--line-strong)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-1)',
                    color: 'var(--fg-3)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadAudio(f);
                    }}
                  />
                  <Icon.Mic size={28} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>
                    {audioName || 'Arrastra tu audio aqui'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    MP3, WAV, M4A - max 25MB
                  </div>
                </label>
              )}
            </Card>

            <Card padding={24}>
              <StepHeader num={3} title="Render" hint="Motor, resolucion y ajustes finales." />

              {/* Motor / realismo */}
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    marginBottom: 8,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  Motor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {AVATAR_MODELS.map((m) => {
                    const disabled = m.requiresAudio && voiceMode !== 'audio';
                    const selected = model === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => !disabled && setModel(m.id)}
                        disabled={disabled}
                        title={disabled ? 'Cambia a "Audio propio" para usar este motor' : m.desc}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          textAlign: 'left',
                          background: selected ? 'var(--red-soft)' : 'var(--bg-1)',
                          border: `1px solid ${selected ? 'var(--red-ring)' : 'var(--line)'}`,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.45 : 1,
                          transition: 'all 180ms',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: selected ? 'var(--red-hi)' : 'var(--fg-1)',
                          }}
                        >
                          {m.label}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {model === 'omni_human' && voiceMode === 'audio' && (
                  <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 0', fontFamily: 'var(--font-mono)' }}>
                    OmniHuman: realismo alto, render más lento.
                  </p>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    marginBottom: 8,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  Resolucion
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {AVATAR_RESOLUTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        textAlign: 'left',
                        background: resolution === r ? 'var(--red-soft)' : 'var(--bg-1)',
                        border: `1px solid ${resolution === r ? 'var(--red-ring)' : 'var(--line)'}`,
                        cursor: 'pointer',
                        transition: 'all 180ms',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: resolution === r ? 'var(--red-hi)' : 'var(--fg-1)',
                        }}
                      >
                        {r}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                        {r === '720p' ? '720x1280 - rapido' : '1080x1920 - alta calidad'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div style={{ position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000' }}>
                {previewUrl ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : selectedImage ? (
                  <img
                    src={selectedImage.dataUrl}
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
                    Subi una imagen
                  </div>
                )}
                {isStreaming && (
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
                      <Spinner size={28} color="var(--red-hi)" />
                      <div
                        className="mono upper"
                        style={{ fontSize: 10, color: 'var(--red-hi)', letterSpacing: 1.5 }}
                      >
                        {phase}
                      </div>
                      <div style={{ fontSize: 12, color: '#fff' }}>{statusMsg}</div>
                    </div>
                  </div>
                )}
                {result && (
                  <div style={{ position: 'absolute', top: 12, left: 12 }}>
                    <Badge tone="success" icon={Icon.Check}>
                      Listo
                    </Badge>
                  </div>
                )}
              </div>
              <div style={{ padding: 20 }}>
                {isStreaming && (
                  <div style={{ marginBottom: 10 }}>
                    <ProgressBar value={null} label={statusMsg} />
                  </div>
                )}
                {phase === 'idle' || phase === 'failed' || phase === 'completed' ? (
                  <Button
                    variant="danger"
                    size="lg"
                    icon={Icon.Sparkles}
                    onClick={generate}
                    style={{ width: '100%' }}
                    disabled={!selectedImage}
                  >
                    {result ? 'Regenerar avatar' : 'Generar avatar'}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={Icon.X}
                    onClick={cancel}
                    style={{ width: '100%' }}
                  >
                    Cancelar
                  </Button>
                )}
                {result && previewUrl && (
                  <a
                    href={previewUrl}
                    download={`avatar-${result.jobId}.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: 8, textDecoration: 'none' }}
                  >
                    <Button variant="primary" size="md" icon={Icon.Download} style={{ width: '100%' }}>
                      Bajar MP4
                    </Button>
                  </a>
                )}
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    marginTop: 10,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {voiceMode === 'audio' && model === 'omni_human'
                    ? '~2-4 min de render - bytedance/omni-human'
                    : '~60-120s de render - prunaai/p-video-avatar'}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ num, title, hint }: { num: number; title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg, var(--red-hi), var(--red))',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 4px 12px var(--red-glow)',
        }}
      >
        {num}
      </span>
      <div>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            margin: 0,
            color: 'var(--fg-1)',
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '2px 0 0' }}>{hint}</p>
      </div>
    </div>
  );
}

function ModeTab({
  icon: I,
  label,
  sub,
  active,
  onClick,
  accent = 'blue',
}: {
  icon: IconComponent;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  accent?: 'red' | 'blue';
}) {
  const c = accent === 'red' ? 'var(--red)' : 'var(--blue)';
  const cSoft = accent === 'red' ? 'var(--red-soft)' : 'var(--blue-soft)';
  const cRing = accent === 'red' ? 'var(--red-ring)' : 'var(--blue-ring)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        background: active ? cSoft : 'var(--bg-1)',
        border: `1px solid ${active ? cRing : 'var(--line)'}`,
        cursor: 'pointer',
        transition: 'all 180ms',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: active ? c : 'var(--bg-3)',
          color: active ? '#fff' : 'var(--fg-2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <I size={16} />
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: active ? (accent === 'red' ? 'var(--red-hi)' : 'var(--blue-hi)') : 'var(--fg-1)',
          }}
        >
          {label}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
