'use client';

import { useMemo } from 'react';
import type { Scene } from '@/editing';
import { framesToMmSs } from '@/editing';
import { useStoryboard } from '../store/context';
import { useSceneDrag } from '../hooks/useSceneDrag';
import { pickThumbnail } from '../utils/thumbnails';
import SceneStatusBadge from './SceneStatusBadge';

interface Props {
  scene: Scene;
  index: number;
  fps: number;
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  hook: { label: 'HOOK', cls: 'bg-brand-pink text-white' },
  intro: { label: 'INTRO', cls: 'bg-brand-yellow text-neutral-800' },
  body: { label: 'BODY', cls: 'bg-neutral-200 text-neutral-700' },
  cta: { label: 'CTA', cls: 'bg-emerald-500 text-white' },
  outro: { label: 'OUTRO', cls: 'bg-neutral-700 text-white' },
  transition: { label: 'TRANS', cls: 'bg-violet-500 text-white' },
};

const EMOTION_GLYPH: Record<string, string> = {
  neutral: '·',
  excited: '🤩',
  serious: '😐',
  inspirational: '✨',
  urgent: '⚠️',
  calm: '🌙',
  playful: '😄',
};

export default function SceneCard({ scene, index, fps }: Props) {
  const { state, dispatch } = useStoryboard();
  const isSelected = state.selectedSceneId === scene.id;
  const { isDragging, isOver, handlers } = useSceneDrag(scene.id, index);

  const thumb = useMemo(() => pickThumbnail(scene), [scene]);
  const role = ROLE_BADGE[scene.role] ?? ROLE_BADGE.body;
  const mainCaption = scene.captions[0]?.text ?? '';
  const assetCount = scene.assets.length;

  return (
    <button
      type="button"
      {...handlers}
      onClick={() => dispatch({ type: 'SELECT_SCENE', sceneId: scene.id })}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-pink ${
        isSelected
          ? 'border-brand-pink ring-2 ring-brand-pink/30'
          : 'border-neutral-200 hover:border-neutral-300'
      } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'translate-x-1' : ''} ${
        !scene.included ? 'opacity-60 saturate-50' : ''
      }`}
      aria-pressed={isSelected}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-900">
        {thumb?.kind === 'video' ? (
          <video
            src={thumb.src}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : thumb?.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.src}
            alt={scene.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
            sin preview
          </div>
        )}

        {/* Badges flotantes */}
        <span
          className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${role.cls}`}
        >
          {role.label}
        </span>
        <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white backdrop-blur-sm">
          {framesToMmSs(scene.durationFrames, fps)}
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] backdrop-blur-sm">
          {EMOTION_GLYPH[scene.emotion] ?? '·'}
        </span>
        <SceneStatusBadge
          scene={scene}
          className="absolute bottom-1.5 right-1.5"
        />
      </div>

      {/* Meta */}
      <div className="flex min-h-[3.5rem] flex-1 flex-col gap-1 px-2.5 py-2">
        <p className="truncate text-[11px] font-semibold text-neutral-800">
          {String(scene.sceneNumber).padStart(2, '0')} · {scene.name}
        </p>
        {mainCaption && (
          <p className="line-clamp-2 text-[10px] leading-tight text-neutral-500">
            {mainCaption}
          </p>
        )}
        <p className="mt-auto flex items-center justify-between gap-1 text-[9px] text-neutral-400">
          <span>{assetCount} asset{assetCount === 1 ? '' : 's'}</span>
          {scene.stylePresetId && (
            <span className="rounded bg-neutral-100 px-1 py-0.5 font-semibold uppercase">
              {scene.stylePresetId}
            </span>
          )}
          {scene.versions.length > 0 && (
            <span className="font-mono text-neutral-500">
              v{scene.versions.length + 1}
            </span>
          )}
        </p>
      </div>

      {/* Indicador drop */}
      {isOver && (
        <div className="absolute inset-y-0 left-0 w-1 bg-brand-pink" aria-hidden />
      )}
    </button>
  );
}
