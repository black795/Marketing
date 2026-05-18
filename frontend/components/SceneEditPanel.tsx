'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Scene } from '@/types/story';
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
  type AdvancedEdit,
  type SceneVersion,
} from '@/lib/scene-history';
import LoadingButton from './loading/LoadingButton';
import ProgressBar from './loading/ProgressBar';

interface SceneEditPanelProps {
  scene: Scene | null;
  history: SceneVersion[];
  regenerating: boolean;
  regenStatus?: string;
  regenError?: string | null;
  onClose: () => void;
  onRegenerate: (args: {
    sceneNumber: number;
    finalPrompt: string;
    edit: AdvancedEdit;
  }) => void;
  onCancelRegenerate: () => void;
  onRestoreVersion: (sceneNumber: number, versionId: string) => void;
}

export default function SceneEditPanel({
  scene,
  history,
  regenerating,
  regenStatus,
  regenError,
  onClose,
  onRegenerate,
  onCancelRegenerate,
  onRestoreVersion,
}: SceneEditPanelProps) {
  const open = scene !== null;

  const [tab, setTab] = useState<'detail' | 'edit' | 'history'>('detail');
  const [edit, setEdit] = useState<AdvancedEdit | null>(
    scene ? initialEditFromScene(scene) : null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const sceneKey = scene?.scene_number ?? -1;
  const prevSceneKey = useRef(sceneKey);

  useEffect(() => {
    if (!scene) {
      setEdit(null);
      return;
    }
    if (prevSceneKey.current !== sceneKey) {
      setEdit(initialEditFromScene(scene));
      setTab('detail');
      prevSceneKey.current = sceneKey;
    }
  }, [scene, sceneKey]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !regenerating) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, regenerating]);

  const baseEdit = useMemo(
    () => (scene ? initialEditFromScene(scene) : null),
    [scene]
  );
  const dirty = edit && baseEdit ? isEditDirty(edit, baseEdit) : false;
  const finalPrompt = edit ? composeFinalPrompt(edit) : '';

  function patchEdit(patch: Partial<AdvancedEdit>) {
    setEdit((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function handleResetEdit() {
    if (scene) setEdit(initialEditFromScene(scene));
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div
        onClick={regenerating ? undefined : onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={
          scene
            ? `Detalle y edición de la escena ${scene.scene_number}`
            : 'Detalle de escena'
        }
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {scene && edit && (
          <>
            <header className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-brand-pink px-2.5 py-1 text-xs font-bold text-white">
                    #{scene.scene_number}
                  </span>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {scene.scene_title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={regenerating}
                  aria-label="Cerrar panel de detalle"
                  className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex items-center gap-1 rounded-md bg-neutral-100 p-1 text-xs font-semibold">
                <TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>
                  Detalle
                </TabButton>
                <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>
                  Edición avanzada
                </TabButton>
                <TabButton
                  active={tab === 'history'}
                  onClick={() => setTab('history')}
                >
                  Historial
                  <span className="ml-1.5 rounded-full bg-brand-pink/10 px-1.5 py-0.5 text-[10px] text-brand-pink">
                    {history.length}
                  </span>
                </TabButton>
              </nav>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === 'detail' && (
                <DetailTab scene={scene} />
              )}

              {tab === 'edit' && (
                <EditTab
                  edit={edit}
                  onPatch={patchEdit}
                  finalPrompt={finalPrompt}
                  onCopyFinal={() =>
                    copyToClipboard(finalPrompt, 'final-prompt')
                  }
                  copiedId={copiedId}
                  dirty={dirty}
                  onReset={handleResetEdit}
                />
              )}

              {tab === 'history' && (
                <HistoryTab
                  history={history}
                  currentSceneImageUrl={scene.image_url ?? null}
                  copiedId={copiedId}
                  onCopy={(text, id) => copyToClipboard(text, id)}
                  onRestore={(versionId) =>
                    onRestoreVersion(scene.scene_number, versionId)
                  }
                  disabled={regenerating}
                />
              )}
            </div>

            <footer className="border-t border-neutral-200 bg-white px-6 py-3">
              {regenerating ? (
                <div className="space-y-2">
                  <ProgressBar
                    value={null}
                    showPercent={false}
                    label={regenStatus ?? 'Regenerando…'}
                  />
                  <div className="flex justify-end">
                    <LoadingButton
                      variant="danger"
                      onClick={onCancelRegenerate}
                    >
                      Cancelar generación
                    </LoadingButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-neutral-500">
                    {tab === 'edit'
                      ? dirty
                        ? `Cambios sin aplicar · ${describeEdit(edit)}`
                        : 'Edita parámetros para generar una nueva versión.'
                      : `Versión actual · ${history.length} en historial`}
                  </p>
                  <div className="flex items-center gap-2">
                    {dirty && tab === 'edit' && (
                      <LoadingButton
                        variant="ghost"
                        onClick={handleResetEdit}
                      >
                        Descartar cambios
                      </LoadingButton>
                    )}
                    <LoadingButton
                      variant="primary"
                      disabled={tab === 'edit' && !dirty}
                      title={
                        tab === 'edit' && !dirty
                          ? 'Ajusta algún parámetro para generar una versión distinta'
                          : 'Generar nueva versión y compararla con la actual'
                      }
                      onClick={() =>
                        onRegenerate({
                          sceneNumber: scene.scene_number,
                          finalPrompt,
                          edit,
                        })
                      }
                      leftIcon={
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      }
                    >
                      {tab === 'edit'
                        ? 'Generar versión nueva'
                        : 'Regenerar esta escena'}
                    </LoadingButton>
                  </div>
                </div>
              )}
              {regenError && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {regenError}
                </p>
              )}
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

// =====================================================================
// Sub-componentes
// =====================================================================

function TabButton({
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
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded px-3 py-1.5 transition ${
        active
          ? 'bg-white text-brand-pink shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}

function DetailTab({ scene }: { scene: Scene }) {
  return (
    <>
      <div
        className="relative mb-5 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
        style={{ aspectRatio: '9 / 16', maxHeight: '420px' }}
      >
        {scene.image_url ? (
          <img
            src={scene.image_url}
            alt={scene.scene_title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-neutral-500">
            Imagen no generada
            {scene.image_error ? (
              <span className="mt-1 block text-xs text-neutral-400">
                {scene.image_error}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Narration
        </h3>
        <p className="rounded-md border-l-4 border-brand-pink bg-pink-50/40 px-4 py-3 text-sm leading-relaxed text-neutral-800">
          {scene.narration}
        </p>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DetailBlock label="Camera" value={scene.camera} />
        <DetailBlock label="Lighting" value={scene.lighting} />
        <DetailBlock label="Emotion" value={scene.emotion} />
      </section>

      <section className="mb-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Image prompt
        </h3>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-800">
          {scene.image_prompt}
        </pre>
      </section>

      <section className="text-xs text-neutral-500">
        Duración:{' '}
        <span className="font-semibold text-neutral-800">{scene.duration}s</span>
      </section>
    </>
  );
}

function EditTab({
  edit,
  onPatch,
  finalPrompt,
  onCopyFinal,
  copiedId,
  dirty,
  onReset,
}: {
  edit: AdvancedEdit;
  onPatch: (p: Partial<AdvancedEdit>) => void;
  finalPrompt: string;
  onCopyFinal: () => void;
  copiedId: string | null;
  dirty: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <section>
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Prompt base
          </h3>
          {dirty && (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] font-semibold text-neutral-500 underline-offset-2 hover:text-brand-pink hover:underline"
            >
              Restaurar original
            </button>
          )}
        </header>
        <textarea
          value={edit.prompt}
          onChange={(e) => onPatch({ prompt: e.target.value })}
          rows={5}
          className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </section>

      <FieldWithPresets
        label="Cámara"
        value={edit.camera}
        onChange={(v) => onPatch({ camera: v })}
        presets={CAMERA_PRESETS}
      />

      <FieldWithPresets
        label="Iluminación"
        value={edit.lighting}
        onChange={(v) => onPatch({ lighting: v })}
        presets={LIGHTING_PRESETS}
      />

      <FieldWithPresets
        label="Emoción"
        value={edit.emotion}
        onChange={(v) => onPatch({ emotion: v })}
        presets={EMOTION_PRESETS}
      />

      <FieldWithPresets
        label="Estilo visual"
        placeholder="Override del estilo global (opcional)"
        value={edit.style}
        onChange={(v) => onPatch({ style: v })}
        presets={STYLE_PRESETS}
      />

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Ángulo
        </h3>
        <div className="flex flex-wrap gap-2">
          <ChipButton
            active={edit.angle === ''}
            onClick={() => onPatch({ angle: '' })}
          >
            Sin override
          </ChipButton>
          {ANGLE_OPTIONS.map((opt) => (
            <ChipButton
              key={opt.value}
              active={edit.angle === opt.value}
              onClick={() => onPatch({ angle: opt.value })}
              title={opt.modifier}
            >
              {opt.label}
            </ChipButton>
          ))}
        </div>
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Intensidad cinematográfica
          </h3>
          <span className="text-xs font-semibold text-brand-pink">
            {INTENSITY_LEVELS[edit.intensity]?.label}
          </span>
        </header>
        <input
          type="range"
          min={0}
          max={INTENSITY_LEVELS.length - 1}
          step={1}
          value={edit.intensity}
          onChange={(e) => onPatch({ intensity: Number(e.target.value) })}
          className="w-full accent-brand-pink"
          aria-label="Intensidad cinematográfica"
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-neutral-500">
          {INTENSITY_LEVELS.map((lvl) => (
            <span
              key={lvl.value}
              className={
                lvl.value === edit.intensity ? 'font-bold text-neutral-800' : ''
              }
            >
              {lvl.label}
            </span>
          ))}
        </div>
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Prompt final (preview)
          </h3>
          <button
            type="button"
            onClick={onCopyFinal}
            className="text-[11px] font-semibold text-neutral-500 underline-offset-2 hover:text-brand-pink hover:underline"
          >
            {copiedId === 'final-prompt' ? '¡Copiado!' : 'Copiar'}
          </button>
        </header>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-900 p-3 font-mono text-[11px] leading-relaxed text-neutral-100">
          {finalPrompt}
        </pre>
      </section>
    </div>
  );
}

function HistoryTab({
  history,
  currentSceneImageUrl,
  copiedId,
  onCopy,
  onRestore,
  disabled,
}: {
  history: SceneVersion[];
  currentSceneImageUrl: string | null;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onRestore: (versionId: string) => void;
  disabled: boolean;
}) {
  if (history.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
        No hay versiones guardadas todavía. La generación inicial cuenta como
        v1 — al regenerar y guardar, las versiones aparecerán aquí.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {history.map((v, idx) => {
        const isCurrent =
          v.image_url !== null && v.image_url === currentSceneImageUrl;
        return (
          <li
            key={v.id}
            className={`flex gap-3 rounded-lg border bg-white p-3 shadow-sm ${
              isCurrent ? 'border-brand-pink ring-1 ring-brand-pink' : 'border-neutral-200'
            }`}
          >
            <div
              className="relative w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100"
              style={{ aspectRatio: '9 / 16' }}
            >
              {v.image_url ? (
                <img
                  src={v.image_url}
                  alt={`Versión ${idx + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-neutral-500">
                  {v.image_error ?? 'Sin imagen'}
                </div>
              )}
              <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                v{idx + 1}
              </span>
              {isCurrent && (
                <span className="absolute right-1 top-1 rounded-full bg-brand-pink px-1.5 py-0.5 text-[10px] font-bold text-white">
                  actual
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span className="font-semibold uppercase tracking-wide">
                  {labelForSource(v.source)} · {formatVersionTimestamp(v.createdAt)}
                </span>
                {v.label && (
                  <span className="rounded-full bg-brand-yellow/40 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                    {v.label}
                  </span>
                )}
              </div>
              <pre className="mb-2 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 px-2 py-1.5 font-mono text-[10px] leading-snug text-neutral-700">
                {v.image_prompt}
              </pre>
              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCopy(v.image_prompt, v.id)}
                  className="text-[11px] font-semibold text-neutral-600 underline-offset-2 hover:text-brand-pink hover:underline"
                >
                  {copiedId === v.id ? '¡Copiado!' : 'Copiar prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => onRestore(v.id)}
                  disabled={disabled || isCurrent || !v.image_url}
                  className="text-[11px] font-semibold text-brand-pink underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
                >
                  Restaurar esta versión
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FieldWithPresets({
  label,
  value,
  onChange,
  presets,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: readonly string[];
  placeholder?: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <ChipButton key={p} active={value === p} onClick={() => onChange(p)}>
            {p}
          </ChipButton>
        ))}
      </div>
    </section>
  );
}

function ChipButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? 'border-brand-pink bg-brand-pink text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-pink hover:text-brand-pink'
      }`}
    >
      {children}
    </button>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="text-sm text-neutral-800">{value}</p>
    </div>
  );
}

function labelForSource(source: SceneVersion['source']): string {
  switch (source) {
    case 'initial':
      return 'Original';
    case 'edit':
      return 'Editada';
    case 'restore':
      return 'Restaurada';
  }
}
