'use client';

import { useState } from 'react';
import type { Scene, VideoSceneOutput } from '@/types/story';

type Tab = 'images' | 'videos' | 'audio' | 'overlays';

interface AssetGalleryProps {
  scenes: Scene[];
  videoScenes: VideoSceneOutput[];

  /** scene_numbers a INCLUIR. Vacío = todas. */
  includedScenes: number[];
  /** Orden custom (scene_numbers). Vacío = orden natural. */
  sceneOrder: number[];

  onPatch: (patch: { includedScenes?: number[]; sceneOrder?: number[] }) => void;

  /** Vuelve al paso de imágenes para regenerar. */
  onRegenerateImages: () => void;
  /** Vuelve al paso de revisión de video para regenerar. */
  onRegenerateVideos: () => void;

  disabled?: boolean;
}

/**
 * Galería de assets del proyecto.
 *
 * Tabs: Imágenes (reales), Videos (reales), Audio y Overlays/Efectos
 * marcados como "próximamente" — el pipeline aún no genera esos tipos,
 * así que no se inventan tarjetas vacías.
 */
export default function AssetGallery({
  scenes,
  videoScenes,
  includedScenes,
  sceneOrder,
  onPatch,
  onRegenerateImages,
  onRegenerateVideos,
  disabled = false,
}: AssetGalleryProps) {
  const [tab, setTab] = useState<Tab>('images');

  const allNumbers = scenes.map((s) => s.scene_number);
  const isIncluded = (n: number) =>
    includedScenes.length === 0 || includedScenes.includes(n);

  function toggleInclude(num: number, include: boolean) {
    let current =
      includedScenes.length === 0 ? [...allNumbers] : [...includedScenes];
    current = include
      ? current.includes(num)
        ? current
        : [...current, num]
      : current.filter((n) => n !== num);
    current.sort((a, b) => a - b);
    const isAll =
      current.length === allNumbers.length &&
      allNumbers.every((n) => current.includes(n));
    onPatch({ includedScenes: isAll ? [] : current });
  }

  const orderedNumbers =
    sceneOrder.length > 0 ? sceneOrder.filter((n) => allNumbers.includes(n)) : allNumbers;

  function reorder(num: number, delta: -1 | 1) {
    const idx = orderedNumbers.indexOf(num);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= orderedNumbers.length) return;
    const next = [...orderedNumbers];
    [next[idx], next[target]] = [next[target], next[idx]];
    onPatch({ sceneOrder: next });
  }

  const videoByNumber = new Map(videoScenes.map((v) => [v.scene_number, v]));
  const totalAssets =
    scenes.length + videoScenes.filter((v) => v.video_url).length;

  return (
    <div>
      {/* Tabs */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Tipo de asset"
          className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1"
        >
          <TabButton active={tab === 'images'} onClick={() => setTab('images')}>
            🖼️ Imágenes
            <Count value={scenes.filter((s) => s.image_url).length} />
          </TabButton>
          <TabButton active={tab === 'videos'} onClick={() => setTab('videos')}>
            🎞️ Videos
            <Count value={videoScenes.filter((v) => v.video_url).length} />
          </TabButton>
          <TabButton active={tab === 'audio'} onClick={() => setTab('audio')}>
            🔊 Audio
          </TabButton>
          <TabButton active={tab === 'overlays'} onClick={() => setTab('overlays')}>
            ✨ Overlays / FX
          </TabButton>
        </div>
        <p className="text-[11px] text-neutral-500">
          {totalAssets} assets · {scenes.length} escenas
        </p>
      </div>

      {sceneOrder.length > 0 && (tab === 'images' || tab === 'videos') && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPatch({ sceneOrder: [] })}
          className="mb-2 text-[11px] font-semibold text-neutral-500 hover:text-brand-pink disabled:opacity-50"
        >
          ↺ Restablecer orden natural
        </button>
      )}

      {tab === 'images' && (
        <SceneList
          orderedNumbers={orderedNumbers}
          scenes={scenes}
          isIncluded={isIncluded}
          onToggleInclude={toggleInclude}
          onReorder={reorder}
          onRegenerate={onRegenerateImages}
          disabled={disabled}
          renderPreview={(scene) =>
            scene.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.image_url}
                alt={scene.scene_title}
                className="h-full w-full object-cover"
              />
            ) : (
              <Missing label="Sin imagen" />
            )
          }
          kindLabel="Imagen"
        />
      )}

      {tab === 'videos' && (
        <SceneList
          orderedNumbers={orderedNumbers}
          scenes={scenes}
          isIncluded={isIncluded}
          onToggleInclude={toggleInclude}
          onReorder={reorder}
          onRegenerate={onRegenerateVideos}
          disabled={disabled}
          renderPreview={(scene) => {
            const v = videoByNumber.get(scene.scene_number);
            const src = v?.local_url || v?.video_url;
            if (src) {
              return (
                <video
                  src={src}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
              );
            }
            return <Missing label="Sin video" />;
          }}
          kindLabel="Video"
        />
      )}

      {tab === 'audio' && (
        <SoonNote
          title="Audio · próximamente"
          body="El pipeline aún no genera voiceover ni música. Esta sección recibirá las pistas en cuanto se integren TTS y biblioteca musical."
        />
      )}

      {tab === 'overlays' && (
        <SoonNote
          title="Overlays y efectos · próximamente"
          body="Stickers, text overlays, motion graphics y transiciones personalizadas se sumarán cuando el editor interno entre en línea."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SceneList({
  orderedNumbers,
  scenes,
  isIncluded,
  onToggleInclude,
  onReorder,
  onRegenerate,
  renderPreview,
  kindLabel,
  disabled,
}: {
  orderedNumbers: number[];
  scenes: Scene[];
  isIncluded: (n: number) => boolean;
  onToggleInclude: (n: number, include: boolean) => void;
  onReorder: (n: number, delta: -1 | 1) => void;
  onRegenerate: () => void;
  renderPreview: (scene: Scene) => React.ReactNode;
  kindLabel: string;
  disabled?: boolean;
}) {
  const sceneByNumber = new Map(scenes.map((s) => [s.scene_number, s]));
  return (
    <>
      <ul className="space-y-2">
        {orderedNumbers.map((num, idx) => {
          const scene = sceneByNumber.get(num);
          if (!scene) return null;
          const included = isIncluded(num);
          return (
            <li
              key={num}
              className={`flex gap-3 rounded-lg border bg-white p-2 transition ${
                included ? 'border-neutral-200' : 'border-dashed border-neutral-300 opacity-60'
              }`}
            >
              <div
                className="relative w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100"
                style={{ aspectRatio: '9 / 16' }}
              >
                {renderPreview(scene)}
                <span className="absolute left-1 top-1 rounded-full bg-brand-pink px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  #{scene.scene_number}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {scene.scene_title}
                  </p>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {scene.duration}s · {kindLabel}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                  {scene.narration}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-[11px]">
                  <button
                    type="button"
                    disabled={disabled || idx === 0}
                    onClick={() => onReorder(num, -1)}
                    aria-label="Mover antes"
                    title="Mover antes"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-600 hover:border-brand-pink hover:text-brand-pink disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    disabled={disabled || idx === orderedNumbers.length - 1}
                    onClick={() => onReorder(num, 1)}
                    aria-label="Mover después"
                    title="Mover después"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-600 hover:border-brand-pink hover:text-brand-pink disabled:opacity-40"
                  >
                    ›
                  </button>
                  <span className="mx-1 h-3 w-px bg-neutral-200" />
                  <label className="inline-flex cursor-pointer items-center gap-1 font-semibold text-neutral-600">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => onToggleInclude(num, e.target.checked)}
                      disabled={disabled}
                      className="h-3.5 w-3.5 accent-brand-pink"
                    />
                    Incluir
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={onRegenerate}
                    title={`Volver al paso de generación de ${kindLabel.toLowerCase()}`}
                    className="ml-auto font-semibold text-neutral-500 hover:text-brand-pink disabled:opacity-50"
                  >
                    ↻ Regenerar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
        active
          ? 'bg-white text-brand-pink shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-neutral-200/70 px-1.5 text-[10px] font-bold text-neutral-600">
      {value}
    </span>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
      {label}
    </div>
  );
}

function SoonNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">{body}</p>
    </div>
  );
}
