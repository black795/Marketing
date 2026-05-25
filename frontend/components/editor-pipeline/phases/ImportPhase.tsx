'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Spinner from '@/components/loading/Spinner';
import { loadTimeline } from '@/lib/captions-api';
import { loadEditingProject } from '@/lib/editing-project-api';
import type { PipelineImports } from '@/lib/editor-pipeline/types';
import type { TimelineDocument, TimelineClip, TimelineCaption } from '@/types/timeline';
import type { TimelineProject } from '@/editing';

interface Props {
  projectId: string;
  value: PipelineImports;
  onChange: (next: PipelineImports) => void;
  onTouched: () => void;
}

/**
 * Fase 2 — Import. Inventario de materiales del proyecto. En Ola 1 leemos
 * el timeline.json y el editing-project.json (los que ya existen) en lugar
 * de listar el filesystem — es suficiente para que el usuario vea, marque y
 * agrupe sus assets.
 *
 * El "import" como tal es declarativo: tildar/destildar marca al asset como
 * incluido en el render. El backend ya tiene todo en disco.
 */
export default function ImportPhase({
  projectId,
  value,
  onChange,
  onTouched,
}: Props) {
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [editingProject, setEditingProject] = useState<TimelineProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadTimeline(projectId).catch(() => null),
      loadEditingProject(projectId).catch(() => null),
    ])
      .then(([tl, ep]) => {
        if (cancelled) return;
        setTimeline(tl);
        setEditingProject(ep);
        onTouched();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando assets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onTouched no debe re-disparar; se ejecuta una sola vez al cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const inventory = useMemo(() => buildInventory(timeline, editingProject), [
    timeline,
    editingProject,
  ]);

  // Auto-seleccionar todo la primera vez (cuando value está vacío y hay assets).
  useEffect(() => {
    if (loading) return;
    const empty =
      value.sceneIds.length === 0 &&
      value.videoIds.length === 0 &&
      value.imageIds.length === 0 &&
      value.audioIds.length === 0 &&
      value.voiceoverIds.length === 0 &&
      value.musicIds.length === 0 &&
      value.referenceIds.length === 0 &&
      value.promptIds.length === 0 &&
      value.scriptIds.length === 0;
    if (!empty) return;
    onChange({
      ...value,
      sceneIds: inventory.scenes.map((s) => s.id),
      videoIds: inventory.videos.map((v) => v.id),
      imageIds: inventory.images.map((i) => i.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, inventory.scenes.length, inventory.videos.length, inventory.images.length]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <Spinner size={18} className="text-brand-pink" />
        <span className="text-sm text-neutral-600">Inventariando assets…</span>
      </div>
    );
  }

  const totalAssets =
    inventory.scenes.length +
    inventory.videos.length +
    inventory.images.length +
    inventory.captions.length +
    (inventory.audio ? 1 : 0);

  if (totalAssets === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-600">
          Este proyecto todavía no tiene assets generados.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Volvé a <Link href={`/scripts`} className="font-semibold text-brand-pink hover:underline">Scripts</Link> para
          crear escenas e imágenes, o construí el timeline a mano desde el
          editor.
        </p>
        {error && <p className="mt-3 text-xs text-red-600">⚠ {error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryBar
        inventory={inventory}
        selected={value}
        onSelectAll={() =>
          onChange({
            ...value,
            sceneIds: inventory.scenes.map((s) => s.id),
            videoIds: inventory.videos.map((v) => v.id),
            imageIds: inventory.images.map((i) => i.id),
            audioIds: inventory.audio ? [inventory.audio.id] : [],
          })
        }
        onClear={() =>
          onChange({
            scriptIds: [],
            sceneIds: [],
            imageIds: [],
            videoIds: [],
            audioIds: [],
            voiceoverIds: [],
            musicIds: [],
            referenceIds: [],
            promptIds: [],
          })
        }
      />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</p>
      )}

      <Group
        title="Escenas"
        emoji="🎬"
        emptyHint="Sin escenas registradas"
        items={inventory.scenes}
        selectedIds={value.sceneIds}
        onToggle={(id) =>
          onChange({ ...value, sceneIds: toggle(value.sceneIds, id) })
        }
      />

      <Group
        title="Videos"
        emoji="🎞️"
        emptyHint="Sin clips de video persistidos"
        items={inventory.videos}
        selectedIds={value.videoIds}
        onToggle={(id) =>
          onChange({ ...value, videoIds: toggle(value.videoIds, id) })
        }
      />

      <Group
        title="Imágenes"
        emoji="🖼️"
        emptyHint="Sin imágenes de referencia"
        items={inventory.images}
        selectedIds={value.imageIds}
        onToggle={(id) =>
          onChange({ ...value, imageIds: toggle(value.imageIds, id) })
        }
      />

      <Group
        title="Captions"
        emoji="✨"
        emptyHint="Captions se generan en la fase 6"
        items={inventory.captions}
        selectedIds={[]}
        readOnly
      />

      {inventory.audio && (
        <Group
          title="Audio"
          emoji="🎵"
          items={[inventory.audio]}
          selectedIds={value.audioIds}
          onToggle={(id) =>
            onChange({ ...value, audioIds: toggle(value.audioIds, id) })
          }
        />
      )}
    </div>
  );
}

// ---------- helpers de UI ----------

interface InventoryItem {
  id: string;
  label: string;
  sublabel?: string;
  thumb?: string | null;
}

function Group({
  title,
  emoji,
  emptyHint,
  items,
  selectedIds,
  onToggle,
  readOnly,
}: {
  title: string;
  emoji: string;
  emptyHint?: string;
  items: InventoryItem[];
  selectedIds: string[];
  onToggle?: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {emoji}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] text-neutral-400">
          {items.length === 0 ? '0' : `${selectedIds.length}/${items.length}`}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="text-xs italic text-neutral-400">{emptyHint ?? 'Sin items'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => {
            const checked = selectedIds.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onToggle?.(it.id)}
                disabled={readOnly}
                className={`group relative flex items-start gap-2 rounded-md border p-2 text-left transition ${
                  checked
                    ? 'border-brand-pink bg-pink-50/50'
                    : 'border-neutral-200 bg-white hover:border-brand-pink/50'
                } ${readOnly ? 'cursor-default opacity-80' : ''}`}
              >
                {it.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumb}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-neutral-100 text-xs text-neutral-400">
                    ?
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-neutral-800">
                    {it.label}
                  </p>
                  {it.sublabel && (
                    <p className="truncate text-[11px] text-neutral-500">
                      {it.sublabel}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <span
                    aria-hidden
                    className={`absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold transition ${
                      checked
                        ? 'bg-brand-pink text-white'
                        : 'bg-neutral-200 text-transparent group-hover:text-neutral-400'
                    }`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryBar({
  inventory,
  selected,
  onSelectAll,
  onClear,
}: {
  inventory: Inventory;
  selected: PipelineImports;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const selectedCount =
    selected.sceneIds.length +
    selected.videoIds.length +
    selected.imageIds.length +
    selected.audioIds.length;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <span className="text-xs font-semibold text-neutral-700">
        Inventario
      </span>
      <span className="text-[11px] text-neutral-500">
        {inventory.scenes.length} escenas · {inventory.videos.length} videos ·{' '}
        {inventory.images.length} imágenes · {inventory.captions.length} captions
        {inventory.audio ? ' · 1 audio' : ''}
      </span>
      <span className="ml-auto text-[11px] text-neutral-500">
        Seleccionados: <strong>{selectedCount}</strong>
      </span>
      <button
        type="button"
        onClick={onSelectAll}
        className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:border-brand-pink hover:text-brand-pink"
      >
        Seleccionar todo
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:border-red-400 hover:text-red-600"
      >
        Limpiar
      </button>
    </div>
  );
}

// ---------- inventory ----------

interface Inventory {
  scenes: InventoryItem[];
  videos: InventoryItem[];
  images: InventoryItem[];
  captions: InventoryItem[];
  audio: InventoryItem | null;
}

function buildInventory(
  tl: TimelineDocument | null,
  ep: TimelineProject | null
): Inventory {
  // Escenas: preferimos el editing-project (rico), fallback al timeline.
  const scenes: InventoryItem[] = ep?.scenes
    ? ep.scenes.map((s, idx) => ({
        id: (s as { id?: string; sceneId?: string }).id ??
          (s as { sceneId?: string }).sceneId ??
          `scene-${idx + 1}`,
        label: (s as { title?: string }).title ?? `Escena ${idx + 1}`,
        sublabel: (s as { description?: string }).description,
        thumb: (s as { thumbnailUrl?: string }).thumbnailUrl ?? null,
      }))
    : tl?.clips
        .filter((c, idx, arr) => arr.findIndex((x) => x.sceneNumber === c.sceneNumber) === idx)
        .map((c) => ({
          id: `scene-${c.sceneNumber}`,
          label: `Escena ${c.sceneNumber}`,
          sublabel: `${c.kind} · ${c.durationFrames}f`,
          thumb: c.src,
        })) ?? [];

  const videos: InventoryItem[] = (tl?.clips ?? [])
    .filter((c): c is TimelineClip & { src: string } => c.kind === 'video' && !!c.src)
    .map((c) => ({
      id: c.id,
      label: `Clip #${c.sceneNumber}`,
      sublabel: `${Math.round((c.durationFrames / (tl?.fps ?? 30)) * 10) / 10}s`,
      thumb: c.src,
    }));

  const images: InventoryItem[] = (tl?.clips ?? [])
    .filter((c): c is TimelineClip & { src: string } => c.kind === 'image' && !!c.src)
    .map((c) => ({
      id: c.id,
      label: `Imagen #${c.sceneNumber}`,
      thumb: c.src,
    }));

  const captions: InventoryItem[] = (tl?.captions ?? []).map((c: TimelineCaption) => ({
    id: c.id,
    label: c.text.slice(0, 40),
    sublabel: `${c.startFrame}f → ${c.endFrame}f · ${c.style}`,
    thumb: null,
  }));

  const audio: InventoryItem | null = tl?.audio
    ? {
        id: 'main-audio',
        label: 'Audio principal',
        sublabel: tl.audio.src.split('/').slice(-1)[0],
        thumb: null,
      }
    : null;

  return { scenes, videos, images, captions, audio };
}

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}
