/**
 * Timeline compartido — `timeline.json`.
 *
 * Es la ÚNICA fuente de verdad del montaje de un proyecto. Tanto el
 * renderer de Remotion como el renderer de Captions consumen este mismo
 * documento, así que escenas, captions, audio y efectos no se duplican.
 *
 * Se construye desde las escenas ya generadas (no cambia la generación) y
 * se persiste en `assets/output/<projectId>/timeline.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_ROOT } from './video-persistence';
import { createLogger } from './logger';

const log = createLogger('timeline');

// --- Esquema del documento --------------------------------------------------

/** Una palabra con su timing — base para word highlighting / karaoke. */
export interface TimelineWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

/** Un subtítulo asociado a un tramo del timeline. */
export interface TimelineCaption {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  /** Timing por palabra. Baseline uniforme; el proveedor de captions lo refina. */
  words: TimelineWord[];
  /** id de estilo viral (tiktok, karaoke, …). 'default' si no se definió. */
  style: string;
}

/** Un clip de video/imagen en la pista principal. */
export interface TimelineClip {
  id: string;
  sceneNumber: number;
  kind: 'image' | 'video';
  src: string | null;
  startFrame: number;
  durationFrames: number;
  /** Transición de entrada (fade, slide, …). */
  transitionIn: string;
  /** Efectos aplicados (zoom, punch, …). */
  effects: string[];
}

export interface TimelineAudio {
  src: string;
  startFrame: number;
}

export interface TimelineDocument {
  /** Versión del esquema, para migraciones futuras. */
  version: 1;
  projectId: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  /** Duración total en frames (suma de los clips). */
  durationFrames: number;
  clips: TimelineClip[];
  captions: TimelineCaption[];
  audio: TimelineAudio | null;
  metadata: {
    createdAt: string;
    sceneCount: number;
    source: 'scripts' | 'avatar' | 'manual';
  };
}

// --- Entrada del builder ----------------------------------------------------

export interface TimelineSceneInput {
  scene_number: number;
  image_url?: string | null;
  video_url?: string | null;
  local_url?: string | null;
  /** Duración en segundos. Default 5. */
  duration?: number;
  /** Texto narrado — semilla de las captions. */
  narration?: string;
}

export interface BuildTimelineInput {
  projectId: string;
  title?: string;
  fps?: number;
  width?: number;
  height?: number;
  source?: 'scripts' | 'avatar' | 'manual';
  scenes: TimelineSceneInput[];
  audioUrl?: string | null;
}

const DEFAULTS = { fps: 30, width: 1080, height: 1920, sceneDuration: 5 };

/** Distribuye el texto en palabras con timing uniforme dentro de [start, end). */
function buildWords(
  text: string,
  startFrame: number,
  endFrame: number
): TimelineWord[] {
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

/**
 * Construye un `timeline.json` a partir de las escenas de un proyecto.
 *
 * Las captions se generan con timing uniforme por palabra como baseline;
 * el proveedor de captions (Captions AI, Whisper) las refina después con
 * timing real sin cambiar el resto del documento.
 */
export function buildTimeline(input: BuildTimelineInput): TimelineDocument {
  const fps = input.fps && input.fps > 0 ? input.fps : DEFAULTS.fps;
  const width = input.width && input.width > 0 ? input.width : DEFAULTS.width;
  const height = input.height && input.height > 0 ? input.height : DEFAULTS.height;

  const ordered = [...input.scenes].sort(
    (a, b) => a.scene_number - b.scene_number
  );

  const clips: TimelineClip[] = [];
  const captions: TimelineCaption[] = [];
  let cursor = 0;

  for (const scene of ordered) {
    const seconds =
      typeof scene.duration === 'number' && scene.duration > 0
        ? scene.duration
        : DEFAULTS.sceneDuration;
    const durationFrames = Math.max(Math.round(seconds * fps), 1);
    const startFrame = cursor;
    const endFrame = startFrame + durationFrames;

    const videoSrc = scene.local_url || scene.video_url || null;
    const kind: TimelineClip['kind'] = videoSrc ? 'video' : 'image';
    const src = videoSrc || scene.image_url || null;

    clips.push({
      id: `clip-${scene.scene_number}`,
      sceneNumber: scene.scene_number,
      kind,
      src,
      startFrame,
      durationFrames,
      transitionIn: startFrame === 0 ? 'none' : 'fade',
      effects: [],
    });

    const narration = (scene.narration || '').trim();
    if (narration) {
      captions.push({
        id: `caption-${scene.scene_number}`,
        text: narration,
        startFrame,
        endFrame,
        words: buildWords(narration, startFrame, endFrame),
        style: 'default',
      });
    }

    cursor = endFrame;
  }

  return {
    version: 1,
    projectId: input.projectId,
    title: input.title || input.projectId,
    fps,
    width,
    height,
    durationFrames: cursor,
    clips,
    captions,
    audio: input.audioUrl
      ? { src: input.audioUrl, startFrame: 0 }
      : null,
    metadata: {
      createdAt: new Date().toISOString(),
      sceneCount: ordered.length,
      source: input.source || 'scripts',
    },
  };
}

function timelinePath(projectId: string): string {
  const safe = projectId.replace(/[^\w\-.]/g, '_');
  return path.join(OUTPUT_ROOT, safe, 'timeline.json');
}

/** Persiste el timeline en assets/output/<projectId>/timeline.json. */
export function saveTimeline(doc: TimelineDocument): string {
  const file = timelinePath(doc.projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  log.info(
    `timeline guardado projectId=${doc.projectId} clips=${doc.clips.length} ` +
      `captions=${doc.captions.length} durationFrames=${doc.durationFrames}`
  );
  return file;
}

/** Carga el timeline persistido de un proyecto. null si no existe. */
export function loadTimeline(projectId: string): TimelineDocument | null {
  try {
    const file = timelinePath(projectId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as TimelineDocument;
  } catch (err) {
    log.error(`no se pudo cargar el timeline de ${projectId}`, undefined, err);
    return null;
  }
}
