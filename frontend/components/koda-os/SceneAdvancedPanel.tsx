'use client';

// Panel lateral derecho del Scenes screen, con tabs:
//   Detalle           — narracion + prompt + metadatos (vista pasiva)
//   Edicion avanzada  — chips/sliders → finalPrompt → regen single scene
//   Historial         — versiones previas con click-to-restore
//
// Port del legacy SceneEditPanel adaptado a CSS-vars del Koda OS design system.
// La regeneracion vive aca (single-scene), no en ScenesScreen, para que el
// estado de regen sea local al panel (cancelable independiente del stream
// bulk de la fase 03).

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './icons';
import { Badge, Button, FieldGroup, IconButton, ProgressBar, Spinner } from './primitives';
import { projectStore, useProject } from './project-store';
import { regenerateSingleScene, StreamCancelledError } from '@/lib/api';
import {
  ANGLE_OPTIONS,
  CAMERA_PRESETS,
  EMOTION_PRESETS,
  INTENSITY_LEVELS,
  LIGHTING_PRESETS,
  STYLE_PRESETS,
  composeFinalPrompt,
  describeEdit,
  formatVersionTimestamp,
  initialEditFromScene,
  isEditDirty,
  makeRequestId,
  sceneFromVersion,
  versionFromScene,
  type AdvancedEdit,
} from '@/lib/scene-history';
import type { Scene } from '@/types/story';

type Tab = 'detail' | 'edit' | 'history';

export interface SceneAdvancedPanelProps {
  scene: Scene;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function SceneAdvancedPanel({
  scene,
  onClose,
  onPrev,
  onNext,
}: SceneAdvancedPanelProps) {
  const { form, sceneHistory } = useProject();
  const history = sceneHistory[scene.scene_number] ?? [];

  const [tab, setTab] = useState<Tab>('detail');
  const [edit, setEdit] = useState<AdvancedEdit>(() => initialEditFromScene(scene));
  const [regenerating, setRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState<string>('');
  const [regenError, setRegenError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const regenAbortRef = useRef<AbortController | null>(null);

  // Reset el edit cuando cambia de escena (no cuando solo cambia image_url).
  const prevKey = useRef(scene.scene_number);
  useEffect(() => {
    if (prevKey.current !== scene.scene_number) {
      setEdit(initialEditFromScene(scene));
      setTab('detail');
      setRegenError(null);
      regenAbortRef.current?.abort();
      prevKey.current = scene.scene_number;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.scene_number]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !regenerating) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, regenerating]);

  useEffect(() => {
    return () => {
      regenAbortRef.current?.abort();
    };
  }, []);

  const baseEdit = useMemo(() => initialEditFromScene(scene), [scene]);
  const dirty = isEditDirty(edit, baseEdit);
  const finalPrompt = composeFinalPrompt(edit);

  function patchEdit(patch: Partial<AdvancedEdit>) {
    setEdit((prev) => ({ ...prev, ...patch }));
  }

  function resetEdit() {
    setEdit(initialEditFromScene(scene));
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenError(null);
    setCancelling(false);
    setRegenStatus('Conectando con el worker...');
    setRegenerating(true);

    const requestId = makeRequestId();
    const abort = new AbortController();
    regenAbortRef.current = abort;

    // Snapshot la version actual ANTES de pisar la escena con la nueva.
    const beforeVersion = versionFromScene(scene, 'initial');

    try {
      const refDataUrls = form.references.map((r) => r.dataUrl);
      const result = await regenerateSingleScene(
        {
          model: form.model,
          scene_number: scene.scene_number,
          image_prompt: finalPrompt,
          quality: form.settings.quality,
          aspectRatio: form.settings.aspectRatio,
          referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        },
        {
          onProgress: (m) => setRegenStatus(m),
        },
        abort.signal,
      );

      // Construye la nueva Scene con prompt + overrides aplicados.
      const newScene: Scene = {
        ...scene,
        camera: edit.camera || scene.camera,
        lighting: edit.lighting || scene.lighting,
        emotion: edit.emotion || scene.emotion,
        image_prompt: edit.prompt,
        image_url: result.image_url,
        ...(result.image_error
          ? { image_error: result.image_error }
          : { image_error: undefined }),
      };

      // Si la escena no tenia historial, sembramos la version inicial.
      const currentHistory = projectStore.getSceneHistory(scene.scene_number);
      if (currentHistory.length === 0) {
        projectStore.addSceneVersion(scene.scene_number, beforeVersion);
      }

      // Append la nueva version (la que acabamos de generar).
      projectStore.addSceneVersion(
        scene.scene_number,
        versionFromScene(newScene, 'edit', describeEdit(edit)),
      );

      projectStore.replaceScene(newScene);
      console.log('[regen] completed', { requestId, sceneNumber: scene.scene_number });
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        setRegenError('Generacion cancelada.');
      } else {
        setRegenError(err instanceof Error ? err.message : 'Error al regenerar');
      }
    } finally {
      setRegenerating(false);
      setCancelling(false);
      setRegenStatus('');
      regenAbortRef.current = null;
    }
  }

  function handleCancel() {
    if (!regenerating || cancelling) return;
    setCancelling(true);
    setRegenStatus('Cancelando...');
    regenAbortRef.current?.abort();
  }

  function handleRestoreVersion(versionId: string) {
    const v = history.find((x) => x.id === versionId);
    if (!v) return;
    const restoredScene = sceneFromVersion(scene, v);
    projectStore.replaceScene(restoredScene);
    // Snapshot la restauracion como nueva entrada del historial.
    projectStore.addSceneVersion(
      scene.scene_number,
      versionFromScene(restoredScene, 'restore', `restored ${formatVersionTimestamp(v.createdAt)}`),
    );
    setEdit(initialEditFromScene(restoredScene));
  }

  return (
    <>
      <div
        onClick={() => (regenerating ? null : onClose())}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7,8,11,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 50,
          cursor: regenerating ? 'wait' : 'pointer',
        }}
      />
      <div
        className="anim-in-right koda-os-root"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 620,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--line)',
          zIndex: 51,
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--line)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Badge tone="blue">SC - {String(scene.scene_number).padStart(2, '0')}</Badge>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--fg-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {scene.scene_title}
            </span>
            {regenerating && <Badge tone="warn" dot>regen</Badge>}
            {!regenerating && dirty && <Badge tone="red" size="sm">sin aplicar</Badge>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton icon={Icon.ArrowL} onClick={onPrev} title="Escena anterior" />
            <IconButton icon={Icon.Arrow} onClick={onNext} title="Escena siguiente" />
            <IconButton
              icon={Icon.X}
              onClick={onClose}
              title={regenerating ? 'Cerrar (la regen continua en background)' : 'Cerrar'}
            />
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            position: 'sticky',
            top: 56,
            zIndex: 1,
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--line)',
            padding: '8px 20px',
            display: 'flex',
            gap: 4,
          }}
        >
          <TabBtn active={tab === 'detail'} onClick={() => setTab('detail')}>
            Detalle
          </TabBtn>
          <TabBtn active={tab === 'edit'} onClick={() => setTab('edit')}>
            <Icon.Wand size={12} /> Edicion avanzada
          </TabBtn>
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
            Historial
            {history.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'var(--blue-soft)',
                  color: 'var(--blue-hi)',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {history.length}
              </span>
            )}
          </TabBtn>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {tab === 'detail' && <DetailTab scene={scene} />}
          {tab === 'edit' && (
            <EditTab
              edit={edit}
              onPatch={patchEdit}
              finalPrompt={finalPrompt}
              dirty={dirty}
              onReset={resetEdit}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              history={history}
              currentImageUrl={scene.image_url ?? null}
              onRestore={handleRestoreVersion}
              disabled={regenerating}
            />
          )}
        </div>

        {/* Footer regen */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg-1)',
            borderTop: '1px solid var(--line)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 2,
          }}
        >
          {regenError && (
            <div
              style={{
                flex: 1,
                fontSize: 12,
                color: 'var(--red-hi)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {regenError}
            </div>
          )}
          {regenerating ? (
            <>
              <div style={{ flex: 1 }}>
                <ProgressBar value={null} label={cancelling ? 'Cancelando...' : regenStatus} />
              </div>
              <Button
                variant="danger"
                size="md"
                icon={Icon.X}
                onClick={handleCancel}
                disabled={cancelling}
                loading={cancelling}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {tab === 'edit'
                  ? dirty
                    ? `cambios sin aplicar - ${describeEdit(edit)}`
                    : `aplicado - ${describeEdit(edit)}`
                  : `${history.length} version${history.length === 1 ? '' : 'es'} en historial`}
              </div>
              <Button
                variant="primary"
                size="md"
                icon={Icon.Refresh}
                onClick={handleRegenerate}
                glow
                disabled={!finalPrompt.trim()}
              >
                Regenerar imagen
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Tabs ----------

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 12px',
        borderRadius: 8,
        background: active ? 'var(--bg-3)' : 'transparent',
        color: active ? 'var(--fg-1)' : 'var(--fg-3)',
        border: `1px solid ${active ? 'var(--line-strong)' : 'transparent'}`,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 160ms',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </button>
  );
}

function DetailTab({ scene }: { scene: Scene }) {
  return (
    <>
      {scene.image_url ? (
        <div
          style={{
            aspectRatio: '9 / 16',
            width: '100%',
            background: '#000',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <img
            src={scene.image_url}
            alt={scene.scene_title}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ) : scene.image_error ? (
        <div
          style={{
            aspectRatio: '9 / 16',
            width: '100%',
            background: 'var(--red-soft)',
            border: '1px solid var(--red-ring)',
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--red-hi)',
            fontSize: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          {scene.image_error}
        </div>
      ) : (
        <div
          style={{
            aspectRatio: '9 / 16',
            width: '100%',
            background: 'var(--bg-3)',
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--fg-3)',
            fontSize: 12,
          }}
        >
          Pendiente
        </div>
      )}

      <FieldGroup letter="A" color="blue" title="Narracion">
        <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.6, margin: 0 }}>
          {scene.narration}
        </p>
      </FieldGroup>

      <FieldGroup letter="B" color="red" title="Image prompt">
        <p
          style={{
            fontSize: 12,
            color: 'var(--fg-2)',
            lineHeight: 1.6,
            margin: 0,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {scene.image_prompt}
        </p>
      </FieldGroup>

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px dashed var(--line)' }}>
        <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 10 }}>
          Metadatos
        </div>
        <table style={{ width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          <tbody>
            <MetaRow k="Camera" v={scene.camera} />
            <MetaRow k="Lighting" v={scene.lighting} />
            <MetaRow k="Emotion" v={scene.emotion} />
            <MetaRow k="Duration" v={`${scene.duration}s`} />
          </tbody>
        </table>
      </div>
    </>
  );
}

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr>
      <td style={{ color: 'var(--fg-3)', padding: '4px 0' }}>{k}</td>
      <td style={{ color: 'var(--fg-1)', textAlign: 'right' }}>{v}</td>
    </tr>
  );
}

// ---------- Edit tab ----------

function EditTab({
  edit,
  onPatch,
  finalPrompt,
  dirty,
  onReset,
}: {
  edit: AdvancedEdit;
  onPatch: (p: Partial<AdvancedEdit>) => void;
  finalPrompt: string;
  dirty: boolean;
  onReset: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ChipField
        label="Camera"
        accent="blue"
        value={edit.camera}
        presets={CAMERA_PRESETS}
        onChange={(v) => onPatch({ camera: v })}
      />
      <ChipField
        label="Lighting"
        accent="blue"
        value={edit.lighting}
        presets={LIGHTING_PRESETS}
        onChange={(v) => onPatch({ lighting: v })}
      />
      <ChipField
        label="Emotion"
        accent="red"
        value={edit.emotion}
        presets={EMOTION_PRESETS}
        onChange={(v) => onPatch({ emotion: v })}
      />
      <ChipField
        label="Style override"
        accent="red"
        value={edit.style}
        presets={STYLE_PRESETS}
        onChange={(v) => onPatch({ style: v })}
        placeholder="opcional - override del estilo base"
      />

      <div>
        <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 6 }}>
          Angulo de camara
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip selected={edit.angle === ''} onClick={() => onPatch({ angle: '' })}>
            Sin override
          </Chip>
          {ANGLE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={edit.angle === o.value}
              onClick={() => onPatch({ angle: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
            fontSize: 11,
          }}
        >
          <span className="mono upper" style={{ color: 'var(--fg-3)' }}>
            Intensidad
          </span>
          <span className="mono" style={{ color: 'var(--blue-hi)', fontWeight: 700 }}>
            {INTENSITY_LEVELS[edit.intensity]?.label ?? 'Natural'}
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${INTENSITY_LEVELS.length}, 1fr)`,
            gap: 4,
            background: 'var(--bg-1)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--line)',
          }}
        >
          {INTENSITY_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              onClick={() => onPatch({ intensity: lvl.value })}
              style={{
                height: 30,
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                background: edit.intensity === lvl.value ? 'var(--bg-3)' : 'transparent',
                color: edit.intensity === lvl.value ? 'var(--fg-1)' : 'var(--fg-3)',
                boxShadow:
                  edit.intensity === lvl.value
                    ? '0 0 0 1px var(--blue-ring), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : 'none',
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                transition: 'all 180ms',
              }}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            Image prompt base
          </span>
          {dirty && (
            <button
              onClick={onReset}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--red-hi)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              reset
            </button>
          )}
        </div>
        <textarea
          value={edit.prompt}
          onChange={(e) => onPatch({ prompt: e.target.value })}
          rows={4}
          style={{
            width: '100%',
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--fg-1)',
            lineHeight: 1.55,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </div>

      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px dashed var(--line-strong)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 6 }}>
          Prompt final que se envia
        </div>
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--fg-2)',
            lineHeight: 1.55,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {finalPrompt}
        </pre>
      </div>
    </div>
  );
}

function ChipField({
  label,
  accent,
  value,
  presets,
  onChange,
  placeholder,
}: {
  label: string;
  accent: 'blue' | 'red';
  value: string;
  presets: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const accentColor = accent === 'blue' ? 'var(--blue)' : 'var(--red)';
  return (
    <div>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          color: 'var(--fg-3)',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: accentColor,
          }}
        />
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'override - libre o usar preset'}
        style={{
          width: '100%',
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          color: 'var(--fg-1)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
          marginBottom: 6,
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {presets.map((p) => (
          <Chip key={p} selected={value === p} onClick={() => onChange(p)}>
            {p}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 22,
    padding: '0 8px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 160ms',
    fontFamily: 'var(--font-mono)',
    background: selected ? 'var(--blue-soft)' : 'var(--bg-1)',
    color: selected ? 'var(--blue-hi)' : 'var(--fg-2)',
    border: `1px solid ${selected ? 'var(--blue-ring)' : 'var(--line)'}`,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

// ---------- History tab ----------

function HistoryTab({
  history,
  currentImageUrl,
  onRestore,
  disabled,
}: {
  history: ReturnType<typeof projectStore.getSceneHistory>;
  currentImageUrl: string | null;
  onRestore: (versionId: string) => void;
  disabled: boolean;
}) {
  if (history.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}
      >
        Aun no regeneraste esta escena. Cada vez que regeneres se va a guardar aca.
      </div>
    );
  }

  // mostrar mas reciente arriba
  const ordered = [...history].reverse();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ordered.map((v) => {
        const isCurrent = v.image_url && v.image_url === currentImageUrl;
        return (
          <div
            key={v.id}
            style={{
              display: 'flex',
              gap: 12,
              padding: 10,
              borderRadius: 10,
              background: 'var(--bg-2)',
              border: `1px solid ${isCurrent ? 'var(--blue-ring)' : 'var(--line)'}`,
            }}
          >
            <div
              style={{
                width: 64,
                height: 96,
                flexShrink: 0,
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--bg-3)',
              }}
            >
              {v.image_url ? (
                <img
                  src={v.image_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--red-hi)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  err
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <Badge tone={v.source === 'initial' ? 'default' : v.source === 'restore' ? 'warn' : 'blue'} size="sm">
                  {v.source}
                </Badge>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                  {formatVersionTimestamp(v.createdAt)}
                </span>
                {isCurrent && (
                  <Badge tone="success" size="sm">
                    actual
                  </Badge>
                )}
              </div>
              {v.label && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-2)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.label}
                </div>
              )}
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {v.image_prompt}
              </div>
            </div>
            <button
              onClick={() => onRestore(v.id)}
              disabled={disabled || !!isCurrent}
              title={isCurrent ? 'Ya es la version actual' : 'Restaurar esta version'}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                color: isCurrent ? 'var(--fg-3)' : 'var(--fg-1)',
                cursor: isCurrent ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                opacity: disabled || isCurrent ? 0.5 : 1,
                transition: 'all 160ms',
              }}
            >
              <Icon.Refresh size={10} /> restaurar
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Re-export para que Spinner sea encontrable si alguien linta este archivo aislado.
void Spinner;
