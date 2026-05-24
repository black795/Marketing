/**
 * Render del video editado — pipeline incremental con cache de segmentos.
 *
 * Pipeline en 3 fases (parallelism-aware):
 *
 *   1. Per-scene encode → `<projectDir>/render-cache/scene-<id>-<hash>.mp4`
 *      Cada escena se normaliza a (width × height @ fps) y se cachea por hash
 *      de contenido. Escenas sin cambios → cache hit (skip).
 *      Hasta N en paralelo (config: `parallelism`, default 4).
 *
 *   2. Concat → ffmpeg concat demuxer (`-c copy`), instantáneo.
 *
 *   3. Final pass → quema captions (libass) + mezcla audio. Reencoding único.
 *      Si no hay captions ni audio, sólo renombra el intermediate.
 *
 * Soporta:
 *   - Cache de segmentos (sceneHash incluye contenido + target).
 *   - Force re-render (`force: true` invalida el cache).
 *   - Export presets (`presetId`: cambia width/height/fps/crf/preset).
 *
 * API pública estable: el route SSE no cambia.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';

import { OUTPUT_ROOT, PROJECT_ROOT } from './video-persistence';
import {
  loadTimeline,
  type TimelineDocument,
  type TimelineClip,
  type TimelineCaption,
} from './timeline';
import { loadEditPlan, type EditPlan } from './edit-plan';
import { createLogger } from './logger';
import {
  sceneHash,
  cachedSegmentPath,
  isCached,
  pruneCache,
  targetFromPreset,
  type CacheTarget,
} from './render-cache';
import { getExportPreset, type ExportPreset } from './render-presets';

const log = createLogger('render');

const PUBLIC_BASE_URL =
  process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';

const DEFAULT_PARALLELISM = Number(process.env.RENDER_PARALLELISM ?? 4);

// ---- Tipos públicos --------------------------------------------------------

export interface RenderResult {
  projectId: string;
  outputPath: string;
  staticPath: string;
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  clipCount: number;
  burnedCaptions: boolean;
  renderedAt: string;
  /** Preset de export aplicado (null si renderConfig nativo). */
  presetId: string | null;
  /** Segmentos servidos desde cache (incremental). */
  cacheHits: number;
  /** Segmentos recién encodeados. */
  cacheMisses: number;
}

export type RenderPhase =
  | 'preparing'
  | 'downloading'
  | 'building-captions'
  | 'encoding-segments'
  | 'concat'
  | 'final-pass'
  | 'encoding'
  | 'done'
  | 'error';

export interface RenderProgressEvent {
  phase: RenderPhase;
  message: string;
  progress?: number;
  detail?: Record<string, unknown>;
}

export interface RenderOptions {
  projectId: string;
  burnCaptions?: boolean;
  signal?: AbortSignal;
  onProgress?: (e: RenderProgressEvent) => void;
  /** Preset de export — overridea width/height/fps/crf/preset. */
  presetId?: string | null;
  /** true = ignora cache y re-encodea todos los segmentos. */
  force?: boolean;
  /** Concurrencia de encoding paralelo. Default 4. */
  parallelism?: number;
}

// ---- Helpers internos preservados (no rompen comportamiento previo) -------

interface ResolvedClip {
  clip: TimelineClip;
  localPath: string;
  newStartFrame: number;
}

function safeProjectId(id: string): string {
  return id.replace(/[^\w\-.]/g, '_');
}

function projectDir(id: string): string {
  return path.join(OUTPUT_ROOT, safeProjectId(id));
}

function applyEditPlan(
  clips: TimelineClip[],
  plan: EditPlan | null
): TimelineClip[] {
  let out = clips.slice();
  if (plan && plan.includedScenes.length > 0) {
    const incl = new Set(plan.includedScenes);
    out = out.filter((c) => incl.has(c.sceneNumber));
  }
  if (plan && plan.sceneOrder.length > 0) {
    const order = new Map<number, number>(
      plan.sceneOrder.map((n, i) => [n, i])
    );
    out = out
      .slice()
      .sort(
        (a, b) =>
          (order.get(a.sceneNumber) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.sceneNumber) ?? Number.MAX_SAFE_INTEGER)
      );
  }
  return out;
}

async function ensureLocalClip(
  clip: TimelineClip,
  cacheDir: string,
  signal?: AbortSignal
): Promise<string> {
  if (!clip.src) {
    throw new Error(
      `Clip de la escena ${clip.sceneNumber} no tiene "src" — regenera o elimínalo del plan.`
    );
  }
  if (clip.src.startsWith('/assets/')) {
    return path.join(PROJECT_ROOT, clip.src.replace(/^\/+/, ''));
  }
  try {
    const u = new URL(clip.src);
    if (u.pathname.startsWith('/assets/')) {
      return path.join(PROJECT_ROOT, u.pathname.replace(/^\/+/, ''));
    }
  } catch {
    /* not a URL */
  }
  if (clip.src.startsWith('file://')) {
    return new URL(clip.src).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  }
  if (path.isAbsolute(clip.src) && fs.existsSync(clip.src)) {
    return clip.src;
  }

  const ext = clip.kind === 'video' ? 'mp4' : guessImageExt(clip.src);
  const dst = path.join(
    cacheDir,
    `clip-${String(clip.sceneNumber).padStart(2, '0')}.${ext}`
  );
  if (fs.existsSync(dst) && fs.statSync(dst).size > 0) return dst;

  log.info(`descargando clip ${clip.sceneNumber} desde ${clip.src}`);
  const resp = await fetch(clip.src, { signal });
  if (!resp.ok || !resp.body) {
    throw new Error(
      `No se pudo descargar el clip de la escena ${clip.sceneNumber}: HTTP ${resp.status}`
    );
  }
  await pipeline(Readable.fromWeb(resp.body as any), createWriteStream(dst));
  return dst;
}

function guessImageExt(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

function remapCaptions(
  timeline: TimelineDocument,
  resolved: ResolvedClip[]
): TimelineCaption[] {
  const out: TimelineCaption[] = [];
  for (const { clip, newStartFrame } of resolved) {
    const orig = timeline.captions.find((c) => c.id === `caption-${clip.sceneNumber}`);
    if (!orig) continue;
    const offset = newStartFrame - orig.startFrame;
    out.push({
      ...orig,
      startFrame: orig.startFrame + offset,
      endFrame: orig.endFrame + offset,
      words: orig.words.map((w) => ({
        ...w,
        startFrame: w.startFrame + offset,
        endFrame: w.endFrame + offset,
      })),
    });
  }
  return out;
}

function framesToAssTime(frames: number, fps: number): string {
  const totalCs = Math.max(Math.round((frames / fps) * 100), 0);
  const cs = totalCs % 100;
  const s = Math.floor(totalCs / 100) % 60;
  const m = Math.floor(totalCs / 6000) % 60;
  const h = Math.floor(totalCs / 360000);
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\r?\n/g, ' ')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .trim();
}

function buildAssFile(
  captions: TimelineCaption[],
  timeline: TimelineDocument,
  target: CacheTarget
): string {
  const header =
    `[Script Info]\n` +
    `Title: Tim Koda Captions\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: ${target.width}\n` +
    `PlayResY: ${target.height}\n` +
    `WrapStyle: 2\n` +
    `ScaledBorderAndShadow: yes\n` +
    `YCbCr Matrix: TV.709\n\n` +
    `[V4+ Styles]\n` +
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Default,Arial Black,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,5,1,2,80,80,260,1\n\n` +
    `[Events]\n` +
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const lines: string[] = [];
  for (const cap of captions) {
    const start = framesToAssTime(cap.startFrame, timeline.fps);
    const end = framesToAssTime(cap.endFrame, timeline.fps);
    const text = escapeAssText(cap.text);
    if (!text) continue;
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
  }
  return header + lines.join('\n') + '\n';
}

function resolveLocalOrRemote(src: string): string {
  if (src.startsWith('/assets/')) {
    return path.join(PROJECT_ROOT, src.replace(/^\/+/, ''));
  }
  try {
    const u = new URL(src);
    if (u.pathname.startsWith('/assets/')) {
      return path.join(PROJECT_ROOT, u.pathname.replace(/^\/+/, ''));
    }
  } catch {
    /* not a URL */
  }
  return src;
}

// ---- ffmpeg runner genérico (parsea -progress pipe:1) ---------------------

function runFfmpeg(opts: {
  args: string[];
  cwd: string;
  totalSeconds: number;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
  label?: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    log.info(`ffmpeg [${opts.label ?? 'job'}] ${opts.args.join(' ')}`);
    const proc = spawn(FFMPEG_BIN, opts.args, { cwd: opts.cwd });

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    let outBuf = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      outBuf += chunk.toString();
      const lines = outBuf.split('\n');
      outBuf = lines.pop() ?? '';
      for (const line of lines) {
        const m = line.match(/^out_time_us=(\d+)/);
        if (m && opts.totalSeconds > 0 && opts.onProgress) {
          const seconds = Number(m[1]) / 1_000_000;
          opts.onProgress(Math.min(seconds / opts.totalSeconds, 1));
        }
      }
    });

    const onAbort = () => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* noop */
      }
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    proc.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    proc.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (opts.signal?.aborted) return reject(new Error('Render cancelado'));
      if (code === 0) return resolve();
      const tail = stderr.trim().split('\n').slice(-6).join('\n');
      reject(new Error(`ffmpeg falló (code ${code}): ${tail || 'sin stderr'}`));
    });
  });
}

// ---- Per-scene segment encoder (cache hit-aware) --------------------------

function buildSegmentArgs(params: {
  localClip: string;
  kind: 'image' | 'video';
  durationSec: number;
  target: CacheTarget;
  outputPath: string;
}): string[] {
  const { localClip, kind, durationSec, target, outputPath } = params;
  const { width, height, fps, crf, preset } = target;
  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
  ];
  if (kind === 'image') {
    args.push('-loop', '1', '-framerate', String(fps), '-t', durationSec.toFixed(3));
  }
  args.push('-i', localClip);
  args.push(
    '-vf',
    `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},setsar=1,fps=${fps}`
  );
  args.push('-t', durationSec.toFixed(3));
  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-an'
  );
  args.push(outputPath);
  return args;
}

async function pLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, i) => ({ item, i }));
  const runners = Array.from({ length: Math.min(Math.max(limit, 1), queue.length) }, async () => {
    while (true) {
      const next = queue.shift();
      if (!next) return;
      await worker(next.item, next.i);
    }
  });
  await Promise.all(runners);
}

// ---- Concat + final pass --------------------------------------------------

async function writeConcatList(segments: string[], listPath: string): Promise<void> {
  // ffmpeg concat demuxer espera paths con forward slashes; en Windows pueden
  // tener backslashes — los convertimos para evitar fallos del parser.
  const lines = segments.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  await fsp.writeFile(listPath, lines.join('\n') + '\n', 'utf-8');
}

function buildConcatArgs(listPath: string, outputPath: string): string[] {
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
    outputPath,
  ];
}

function buildFinalPassArgs(params: {
  inputPath: string;
  audioPath: string | null;
  subtitleFile: string | null;
  target: CacheTarget;
  audioKbps: number;
  outputPath: string;
}): string[] {
  const { inputPath, audioPath, subtitleFile, target, audioKbps, outputPath } = params;
  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-i',
    inputPath,
  ];
  if (audioPath) args.push('-i', audioPath);

  if (subtitleFile) {
    args.push('-vf', `ass=${subtitleFile}`);
    args.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      target.preset,
      '-crf',
      String(target.crf)
    );
  } else {
    // Sin captions → copia el video tal cual; sólo re-mux para añadir audio si hay.
    args.push('-c:v', 'copy');
  }

  if (audioPath) {
    args.push('-map', '0:v', '-map', '1:a');
    args.push('-c:a', 'aac', '-b:a', `${audioKbps}k`, '-shortest');
  }

  args.push('-movflags', '+faststart', outputPath);
  return args;
}

// ---- API pública -----------------------------------------------------------

export async function renderProject(opts: RenderOptions): Promise<RenderResult> {
  const {
    projectId,
    burnCaptions = true,
    signal,
    onProgress,
    presetId = null,
    force = false,
    parallelism = DEFAULT_PARALLELISM,
  } = opts;
  const emit = (e: RenderProgressEvent) => {
    try {
      onProgress?.(e);
    } catch (err) {
      log.error('onProgress lanzó una excepción', undefined, err);
    }
  };

  emit({ phase: 'preparing', message: 'Cargando timeline y plan…' });

  const timeline = loadTimeline(projectId);
  if (!timeline) {
    throw new Error(
      `No hay timeline para "${projectId}". Vuelve al Hub y construye el timeline.`
    );
  }
  const plan = loadEditPlan(projectId);
  const filtered = applyEditPlan(timeline.clips, plan);
  if (filtered.length === 0) {
    throw new Error('No hay clips para renderizar (el plan filtró todas las escenas).');
  }

  // Target efectivo: preset override o config del timeline.
  const preset: ExportPreset | null = getExportPreset(presetId);
  const target: CacheTarget = preset
    ? targetFromPreset(preset)
    : { width: timeline.width, height: timeline.height, fps: timeline.fps, crf: 20, preset: 'fast' };
  const audioKbps = preset?.audioKbps ?? 192;

  const safeId = safeProjectId(projectId);
  const projDir = projectDir(projectId);
  const cacheDir = path.join(projDir, 'render-cache');
  await fsp.mkdir(cacheDir, { recursive: true });

  // ---- 1. Descargar/resolver clips ----------------------------------------
  emit({
    phase: 'downloading',
    message: 'Preparando clips…',
    progress: 0,
    detail: { total: filtered.length },
  });
  const resolved: ResolvedClip[] = [];
  let cursor = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (signal?.aborted) throw new Error('Render cancelado');
    const clip = filtered[i];
    const localPath = await ensureLocalClip(clip, cacheDir, signal);
    resolved.push({ clip, localPath, newStartFrame: cursor });
    cursor += clip.durationFrames;
    emit({
      phase: 'downloading',
      message: `Clip ${i + 1}/${filtered.length} listo`,
      progress: (i + 1) / filtered.length,
    });
  }
  const totalSec = cursor / timeline.fps;

  // ---- 2. Captions --------------------------------------------------------
  let subtitleFile: string | null = null;
  if (burnCaptions && timeline.captions.length > 0) {
    emit({ phase: 'building-captions', message: 'Compilando subtítulos…' });
    const remapped = remapCaptions(timeline, resolved);
    if (remapped.length > 0) {
      const ass = buildAssFile(remapped, timeline, target);
      const assPath = path.join(projDir, 'captions.ass');
      await fsp.writeFile(assPath, ass, 'utf-8');
      subtitleFile = 'captions.ass';
    }
  }

  // ---- 3. Encoding por segmento (parallel + cache) ------------------------
  emit({
    phase: 'encoding-segments',
    message: `Encoding ${resolved.length} segmento(s)…`,
    progress: 0,
    detail: { total: resolved.length, parallelism, force },
  });

  const segmentPaths: string[] = new Array(resolved.length);
  const segmentHashes: string[] = new Array(resolved.length);
  let done = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  await pLimit(resolved, parallelism, async (r, i) => {
    if (signal?.aborted) throw new Error('Render cancelado');
    const hash = sceneHash(
      {
        id: r.clip.id,
        sceneNumber: r.clip.sceneNumber,
        startFrame: r.clip.startFrame,
        endFrame: r.clip.startFrame + r.clip.durationFrames,
        durationFrames: r.clip.durationFrames,
        assets: [{ kind: r.clip.kind, src: r.clip.src }],
        effects: r.clip.effects.map((k) => ({ kind: k, params: {} })),
      },
      target
    );
    const outPath = cachedSegmentPath(projDir, r.clip.id, hash);
    segmentPaths[i] = outPath;
    segmentHashes[i] = hash;

    if (!force && isCached(outPath)) {
      cacheHits += 1;
    } else {
      cacheMisses += 1;
      const args = buildSegmentArgs({
        localClip: r.localPath,
        kind: r.clip.kind,
        durationSec: r.clip.durationFrames / timeline.fps,
        target,
        outputPath: outPath,
      });
      await runFfmpeg({
        args,
        cwd: projDir,
        totalSeconds: r.clip.durationFrames / timeline.fps,
        signal,
        label: `segment-${r.clip.sceneNumber}`,
      });
    }
    done += 1;
    emit({
      phase: 'encoding-segments',
      message: `Segmentos listos ${done}/${resolved.length}${cacheHits ? ` · cache ${cacheHits}` : ''}`,
      progress: done / resolved.length,
    });
  });

  // ---- 4. Concat demuxer --------------------------------------------------
  emit({ phase: 'concat', message: 'Uniendo segmentos…' });
  const concatListPath = path.join(projDir, 'render-cache', 'concat.txt');
  await writeConcatList(segmentPaths, concatListPath);
  const intermediatePath = path.join(projDir, 'render-cache', 'intermediate.mp4');
  await runFfmpeg({
    args: buildConcatArgs(concatListPath, intermediatePath),
    cwd: projDir,
    totalSeconds: 0,
    signal,
    label: 'concat',
  });

  // ---- 5. Final pass (captions + audio) -----------------------------------
  let audioPath: string | null = null;
  if (timeline.audio?.src) audioPath = resolveLocalOrRemote(timeline.audio.src);

  const outputPath = path.join(projDir, 'edited.mp4');

  if (!subtitleFile && !audioPath) {
    // Sin captions ni audio → mover el intermediate como output final.
    await fsp.copyFile(intermediatePath, outputPath);
    emit({ phase: 'final-pass', message: 'Sin captions ni audio — copia directa.', progress: 1 });
  } else {
    emit({
      phase: 'final-pass',
      message: subtitleFile ? 'Quemando captions + audio…' : 'Añadiendo audio…',
      progress: 0,
    });
    await runFfmpeg({
      args: buildFinalPassArgs({
        inputPath: intermediatePath,
        audioPath,
        subtitleFile,
        target,
        audioKbps,
        outputPath,
      }),
      cwd: projDir,
      totalSeconds: totalSec,
      signal,
      onProgress: (p) =>
        emit({ phase: 'final-pass', message: 'Final pass…', progress: p }),
      label: 'final-pass',
    });
  }

  // ---- 6. Limpieza de cache antiguo ---------------------------------------
  pruneCache(projDir, new Set(segmentPaths), 30);

  // ---- 7. Persistir metadata ---------------------------------------------
  const result: RenderResult = {
    projectId: safeId,
    outputPath,
    staticPath: `/assets/output/${safeId}/edited.mp4`,
    url: `${PUBLIC_BASE_URL}/assets/output/${safeId}/edited.mp4`,
    durationSeconds: totalSec,
    width: target.width,
    height: target.height,
    fps: target.fps,
    clipCount: resolved.length,
    burnedCaptions: !!subtitleFile,
    renderedAt: new Date().toISOString(),
    presetId: preset?.id ?? null,
    cacheHits,
    cacheMisses,
  };

  await fsp.writeFile(
    path.join(projDir, 'render.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );

  log.info(
    `render listo projectId=${safeId} clips=${resolved.length} ` +
      `dur=${totalSec.toFixed(2)}s captions=${result.burnedCaptions} ` +
      `cache=${cacheHits}/${resolved.length} preset=${preset?.id ?? '-'}`
  );
  emit({
    phase: 'done',
    message: 'Render completo',
    detail: { url: result.url, durationSec: totalSec, cacheHits, presetId: preset?.id ?? null },
  });

  return result;
}

/** Devuelve el último render persistido del proyecto. */
export function loadLastRender(projectId: string): RenderResult | null {
  try {
    const file = path.join(projectDir(projectId), 'render.json');
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as RenderResult;
  } catch (err) {
    log.error('no se pudo leer render.json', { projectId }, err);
    return null;
  }
}
