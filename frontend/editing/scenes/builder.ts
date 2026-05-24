/**
 * Scene Builder automático.
 *
 * Convierte las fuentes existentes (guion, imágenes, videos, narraciones)
 * en el array de `Scene` del scene graph. Funciona en dos modos:
 *
 *   1. `fromTimelineDocument(doc)` — toma el timeline.json legacy y produce
 *      escenas equivalentes (mismos clips + captions, ahora ricos).
 *
 *   2. `fromStoryScenes(scenes, opts)` — toma `Scene[]` del flujo Scripts/Story
 *      (con `narration`, `image_prompt`, `image_url`, `video_url`, `emotion`)
 *      y produce escenas listas para editar antes de que exista timeline.
 *
 * Ambos paths corren por el clasificador para asignar `role` (hook/intro/…).
 */
import type {
  Scene,
  SceneAsset,
  SceneCaption,
  SceneEmotion,
  SceneTransition,
  SceneWord,
} from '../types/scene';
import type { TimelineDocument } from '@/types/timeline';
import type { Scene as StoryScene, VideoSceneOutput } from '@/types/story';
import { classifyScene } from './classifier';
import {
  newAssetId,
  newCaptionId,
  newSceneId,
} from '../utils/ids';
import { secondsToFrames } from '../utils/time';

const DEFAULT_TRANSITION: SceneTransition = {
  inKind: 'fade',
  outKind: 'cut',
  inDurationFrames: 8,
  outDurationFrames: 0,
};

/** Hace match laxo entre la cadena del backend y el enum de emociones. */
function normalizeEmotion(raw: string | undefined): SceneEmotion {
  if (!raw) return 'neutral';
  const k = raw.trim().toLowerCase();
  if (/(excit|hype|wow|amaz)/.test(k)) return 'excited';
  if (/(seri|prof|grav)/.test(k)) return 'serious';
  if (/(insp|motiv|hope)/.test(k)) return 'inspirational';
  if (/(urgen|fast|alert)/.test(k)) return 'urgent';
  if (/(calm|peaceful|relax|tranq)/.test(k)) return 'calm';
  if (/(play|fun|joy|happy|divert)/.test(k)) return 'playful';
  return 'neutral';
}

function uniformWords(text: string, startFrame: number, endFrame: number): SceneWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(endFrame - startFrame, 1);
  const per = span / tokens.length;
  return tokens.map((tok, i) => ({
    text: tok,
    startFrame: Math.round(startFrame + per * i),
    endFrame: Math.round(startFrame + per * (i + 1)),
  }));
}

// ---- 1. Desde un timeline.json existente -----------------------------------

export function fromTimelineDocument(doc: TimelineDocument): Scene[] {
  const out: Scene[] = [];
  const total = doc.clips.length;

  for (let i = 0; i < doc.clips.length; i++) {
    const clip = doc.clips[i];
    const cap = doc.captions.find((c) => c.id === `caption-${clip.sceneNumber}`);
    const startFrame = clip.startFrame;
    const endFrame = startFrame + clip.durationFrames;

    const assets: SceneAsset[] = clip.src
      ? [
          {
            id: newAssetId(clip.kind),
            kind: clip.kind,
            src: clip.src,
          },
        ]
      : [];

    const captions: SceneCaption[] = cap
      ? [
          {
            id: cap.id || newCaptionId(clip.sceneNumber),
            text: cap.text,
            startFrame: cap.startFrame,
            endFrame: cap.endFrame,
            style: cap.style || 'default',
            words: cap.words?.length
              ? cap.words.map((w) => ({ ...w }))
              : uniformWords(cap.text, cap.startFrame, cap.endFrame),
          },
        ]
      : [];

    out.push({
      id: newSceneId(clip.sceneNumber),
      sceneNumber: clip.sceneNumber,
      name: `Escena ${clip.sceneNumber}`,
      role: classifyScene({
        index: i,
        total,
        narration: cap?.text ?? '',
      }),
      startFrame,
      endFrame,
      durationFrames: clip.durationFrames,
      assets,
      overlays: [],
      captions,
      audioTracks: [],
      transition: {
        ...DEFAULT_TRANSITION,
        inKind: clip.transitionIn || (i === 0 ? 'none' : 'fade'),
      },
      effects: clip.effects.map((kind) => ({
        id: `fx-${kind}-${clip.sceneNumber}`,
        kind,
        params: {},
      })),
      camera: null,
      emotion: 'neutral',
      prompt: '',
      stylePresetId: null,
      renderState: clip.kind === 'video' ? 'ready' : 'pending',
      versions: [],
      included: true,
    });
  }
  return out;
}

// ---- 2. Desde el flujo Scripts (Story scenes + Video scenes) ---------------

export interface FromStoryOptions {
  fps: number;
  /** Default si la escena no trae duration. */
  defaultDurationSec?: number;
  /** Outputs de video (si ya existen) para asociar a las escenas. */
  videoScenes?: VideoSceneOutput[];
}

export function fromStoryScenes(
  scenes: StoryScene[],
  opts: FromStoryOptions
): Scene[] {
  const fps = opts.fps;
  const fallback = opts.defaultDurationSec ?? 5;
  const total = scenes.length;
  const videoByNumber = new Map<number, VideoSceneOutput>();
  for (const v of opts.videoScenes ?? []) {
    videoByNumber.set(v.scene_number, v);
  }

  const out: Scene[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const durationSec = typeof s.duration === 'number' && s.duration > 0 ? s.duration : fallback;
    const durationFrames = secondsToFrames(durationSec, fps);
    const startFrame = cursor;
    const endFrame = startFrame + durationFrames;

    const video = videoByNumber.get(s.scene_number);
    const videoSrc = video?.local_url || video?.video_url || null;

    const assets: SceneAsset[] = [];
    if (s.image_url) {
      assets.push({
        id: newAssetId('image'),
        kind: 'image',
        src: s.image_url,
        generatedBy: s.image_prompt
          ? {
              provider: 'replicate',
              model: 'unknown',
              prompt: s.image_prompt,
              createdAt: new Date().toISOString(),
            }
          : undefined,
      });
    }
    if (videoSrc) {
      assets.push({
        id: newAssetId('video'),
        kind: 'video',
        src: videoSrc,
        generatedBy: video?.video_prompt
          ? {
              provider: 'replicate',
              model: 'kling',
              prompt: video.video_prompt,
              createdAt: new Date().toISOString(),
            }
          : undefined,
      });
    }

    const captions: SceneCaption[] = s.narration?.trim()
      ? [
          {
            id: newCaptionId(s.scene_number),
            text: s.narration.trim(),
            startFrame,
            endFrame,
            style: 'default',
            words: uniformWords(s.narration.trim(), startFrame, endFrame),
          },
        ]
      : [];

    out.push({
      id: newSceneId(s.scene_number),
      sceneNumber: s.scene_number,
      name: s.scene_title || `Escena ${s.scene_number}`,
      role: classifyScene({ index: i, total, narration: s.narration ?? '' }),
      startFrame,
      endFrame,
      durationFrames,
      assets,
      overlays: [],
      captions,
      audioTracks: [],
      transition: {
        ...DEFAULT_TRANSITION,
        inKind: i === 0 ? 'none' : 'fade',
      },
      effects: [],
      camera: s.camera ? { preset: s.camera } : null,
      emotion: normalizeEmotion(s.emotion),
      prompt: s.image_prompt ?? '',
      stylePresetId: null,
      renderState: videoSrc ? 'ready' : s.image_url ? 'pending' : 'pending',
      versions: [],
      included: true,
    });

    cursor = endFrame;
  }
  return out;
}
