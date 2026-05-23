/**
 * Render del video editado — la SALIDA del editor.
 *
 * Toma el `timeline.json` (clips + captions) y, si existe, el `edit-plan.json`
 * (escenas incluidas + orden custom), descarga los clips remotos a un cache
 * local, compila los subtítulos a un archivo ASS y ejecuta una sola llamada
 * a `ffmpeg` con `filter_complex` para:
 *
 *   1. Normalizar cada clip a `width x height @ fps` con crop "cover".
 *   2. Concatenar todos los clips en orden.
 *   3. Quemar los subtítulos encima con libass (opcional).
 *   4. Mezclar el audio si el timeline lo tiene.
 *
 * Salida: `assets/output/<projectId>/edited.mp4` + `render.json` con metadata.
 *
 * Diseño de errores: el caller (la ruta SSE) emite los eventos al cliente;
 * este servicio sólo notifica progreso vía `onProgress`. Lanza errores con
 * mensajes claros si falta el timeline, no hay clips, o ffmpeg falla.
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

const log = createLogger('render');

const PUBLIC_BASE_URL =
  process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';

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
}

export type RenderPhase =
  | 'preparing'
  | 'downloading'
  | 'building-captions'
  | 'encoding'
  | 'done'
  | 'error';

export interface RenderProgressEvent {
  phase: RenderPhase;
  message: string;
  /** 0..1 dentro de la fase actual (cuando aplica). */
  progress?: number;
  detail?: Record<string, unknown>;
}

export interface RenderOptions {
  projectId: string;
  /** Quema los subtítulos del timeline sobre el video (default true). */
  burnCaptions?: boolean;
  signal?: AbortSignal;
  onProgress?: (e: RenderProgressEvent) => void;
}

// ---- Helpers internos ------------------------------------------------------

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
    // Los que no estén en sceneOrder van al final, en su orden natural.
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

/**
 * Si `clip.src` apunta a algo local o servido por express.static, devuelve
 * el path absoluto en disco. Si es remoto (https), lo descarga al cache.
 */
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

  // 1) Path estático /assets/... → relativo a la raíz del proyecto.
  if (clip.src.startsWith('/assets/')) {
    return path.join(PROJECT_ROOT, clip.src.replace(/^\/+/, ''));
  }
  // 2) http(s) que apunta al propio backend → resolver a path local.
  try {
    const u = new URL(clip.src);
    if (u.pathname.startsWith('/assets/')) {
      return path.join(PROJECT_ROOT, u.pathname.replace(/^\/+/, ''));
    }
  } catch {
    /* no es URL absoluta */
  }
  // 3) file:// → path local.
  if (clip.src.startsWith('file://')) {
    return new URL(clip.src).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  }
  // 4) Path absoluto del disco.
  if (path.isAbsolute(clip.src) && fs.existsSync(clip.src)) {
    return clip.src;
  }

  // 5) Remoto → descargar al cache.
  const ext = clip.kind === 'video' ? 'mp4' : guessImageExt(clip.src);
  const dst = path.join(
    cacheDir,
    `clip-${String(clip.sceneNumber).padStart(2, '0')}.${ext}`
  );
  if (fs.existsSync(dst) && fs.statSync(dst).size > 0) {
    return dst;
  }

  log.info(`descargando clip ${clip.sceneNumber} desde ${clip.src}`);
  const resp = await fetch(clip.src, { signal });
  if (!resp.ok || !resp.body) {
    throw new Error(
      `No se pudo descargar el clip de la escena ${clip.sceneNumber}: HTTP ${resp.status}`
    );
  }
  await pipeline(
    Readable.fromWeb(resp.body as any),
    createWriteStream(dst)
  );
  return dst;
}

function guessImageExt(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

/**
 * El edit-plan pudo reordenar/filtrar clips. Las captions del timeline tienen
 * `startFrame`/`endFrame` anclados al timeline ORIGINAL. Aquí las recolocamos
 * sobre el NUEVO timeline (mantenemos la duración relativa de cada caption).
 */
function remapCaptions(
  timeline: TimelineDocument,
  resolved: ResolvedClip[]
): TimelineCaption[] {
  const out: TimelineCaption[] = [];
  for (const { clip, newStartFrame } of resolved) {
    const orig = timeline.captions.find(
      (c) => c.id === `caption-${clip.sceneNumber}`
    );
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

/**
 * Construye el .ass para libass. Estilo "viral" por defecto: Arial Black
 * blanco con outline negro grueso, centrado-bajo, sombra suave. Se puede
 * iterar después leyendo `editPlan.captionTemplateId` y mapeando a estilos.
 */
function buildAssFile(
  captions: TimelineCaption[],
  timeline: TimelineDocument
): string {
  const header =
    `[Script Info]\n` +
    `Title: Tim Koda Captions\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: ${timeline.width}\n` +
    `PlayResY: ${timeline.height}\n` +
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

// ---- Construcción de la línea de comandos ffmpeg ---------------------------

interface FfmpegInput {
  path: string;
  kind: 'image' | 'video';
  /** Duración deseada del clip en segundos. */
  durationSec: number;
}

function buildFfmpegArgs(params: {
  clips: FfmpegInput[];
  width: number;
  height: number;
  fps: number;
  audioPath: string | null;
  /** Nombre del .ass relativo al CWD del proceso (para evitar escaping de paths). */
  subtitleFile: string | null;
  outputPath: string;
}): string[] {
  const { clips, width, height, fps, audioPath, subtitleFile, outputPath } =
    params;

  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-stats_period',
    '0.5',
    '-progress',
    'pipe:1',
  ];

  // Inputs
  for (const c of clips) {
    if (c.kind === 'image') {
      args.push('-loop', '1');
      args.push('-framerate', String(fps));
      args.push('-t', c.durationSec.toFixed(3));
      args.push('-i', c.path);
    } else {
      args.push('-i', c.path);
    }
  }

  const audioIdx = audioPath ? clips.length : -1;
  if (audioPath) {
    args.push('-i', audioPath);
  }

  // filter_complex: normalizar cada clip + concat + (opcional) subtitles.
  const filters: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    // "cover crop": escala manteniendo aspecto, luego recorta al exacto.
    filters.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1,fps=${fps},` +
        `trim=duration=${c.durationSec.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
    );
  }
  const concatInputs = clips.map((_, i) => `[v${i}]`).join('');
  filters.push(
    `${concatInputs}concat=n=${clips.length}:v=1:a=0[merged]`
  );

  let lastLabel = '[merged]';
  if (subtitleFile) {
    // Path relativo al CWD del proceso ffmpeg para esquivar el escape
    // de ":" en filtros en Windows (el caller usa cwd = projectDir).
    filters.push(`[merged]ass=${subtitleFile}[withcaps]`);
    lastLabel = '[withcaps]';
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', lastLabel);
  if (audioIdx >= 0) {
    args.push('-map', `${audioIdx}:a`);
    args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-r',
    String(fps),
    '-movflags',
    '+faststart',
    outputPath
  );

  return args;
}

/**
 * Ejecuta ffmpeg parseando `-progress pipe:1` para reportar avance.
 * `out_time_us` es microsegundos a pesar del nombre (campo "_us" desde
 * ffmpeg 4.x): lo dividimos por la duración total para sacar el 0..1.
 */
function runFfmpeg(opts: {
  args: string[];
  cwd: string;
  totalSeconds: number;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    log.info(`ffmpeg ${opts.args.join(' ')}`);
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
        if (m) {
          const seconds = Number(m[1]) / 1_000_000;
          if (opts.totalSeconds > 0 && opts.onProgress) {
            opts.onProgress(Math.min(seconds / opts.totalSeconds, 1));
          }
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
      if (opts.signal?.aborted) {
        return reject(new Error('Render cancelado'));
      }
      if (code === 0) return resolve();
      const tail = stderr.trim().split('\n').slice(-6).join('\n');
      reject(new Error(`ffmpeg falló (code ${code}): ${tail || 'sin stderr'}`));
    });
  });
}

// ---- API pública -----------------------------------------------------------

/**
 * Punto de entrada del render. Lee el timeline y el plan, prepara los clips,
 * arma los subtítulos y ejecuta ffmpeg. Devuelve la URL pública del MP4.
 */
export async function renderProject(
  opts: RenderOptions
): Promise<RenderResult> {
  const { projectId, burnCaptions = true, signal, onProgress } = opts;
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
    throw new Error(
      'No hay clips para renderizar (el plan filtró todas las escenas).'
    );
  }

  const safeId = safeProjectId(projectId);
  const projDir = projectDir(projectId);
  const cacheDir = path.join(projDir, 'render-cache');
  await fsp.mkdir(cacheDir, { recursive: true });

  // Descargar / resolver cada clip y calcular su nueva posición temporal.
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

  // Subtítulos
  let subtitleFile: string | null = null;
  if (burnCaptions && timeline.captions.length > 0) {
    emit({
      phase: 'building-captions',
      message: 'Compilando subtítulos…',
    });
    const remapped = remapCaptions(timeline, resolved);
    if (remapped.length > 0) {
      const ass = buildAssFile(remapped, timeline);
      const assPath = path.join(projDir, 'captions.ass');
      await fsp.writeFile(assPath, ass, 'utf-8');
      // ffmpeg corre con cwd = projDir, así que el filtro recibe el basename
      // sin paths absolutos (evita el infierno de escape en Windows).
      subtitleFile = 'captions.ass';
    }
  }

  // Audio: si el timeline tiene una URL HTTPS, la descargamos al cache. Si
  // es ya un path estático, ensureLocalClip-like sería overkill aquí — sólo
  // resolvemos URLs locales y dejamos las remotas pasar tal cual a ffmpeg.
  let audioPath: string | null = null;
  if (timeline.audio?.src) {
    audioPath = resolveLocalOrRemote(timeline.audio.src);
  }

  // Encoding
  const totalSec = cursor / timeline.fps;
  emit({
    phase: 'encoding',
    message: 'Renderizando con ffmpeg…',
    progress: 0,
    detail: { durationSec: totalSec },
  });

  const outputPath = path.join(projDir, 'edited.mp4');
  const ffArgs = buildFfmpegArgs({
    clips: resolved.map((r) => ({
      path: r.localPath,
      kind: r.clip.kind,
      durationSec: r.clip.durationFrames / timeline.fps,
    })),
    width: timeline.width,
    height: timeline.height,
    fps: timeline.fps,
    audioPath,
    subtitleFile,
    outputPath,
  });

  await runFfmpeg({
    args: ffArgs,
    cwd: projDir,
    totalSeconds: totalSec,
    signal,
    onProgress: (p) =>
      emit({
        phase: 'encoding',
        message: 'Renderizando…',
        progress: p,
      }),
  });

  const result: RenderResult = {
    projectId: safeId,
    outputPath,
    staticPath: `/assets/output/${safeId}/edited.mp4`,
    url: `${PUBLIC_BASE_URL}/assets/output/${safeId}/edited.mp4`,
    durationSeconds: totalSec,
    width: timeline.width,
    height: timeline.height,
    fps: timeline.fps,
    clipCount: resolved.length,
    burnedCaptions: !!subtitleFile,
    renderedAt: new Date().toISOString(),
  };

  await fsp.writeFile(
    path.join(projDir, 'render.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );

  log.info(
    `render listo projectId=${safeId} clips=${resolved.length} ` +
      `dur=${totalSec.toFixed(2)}s captions=${result.burnedCaptions}`
  );
  emit({
    phase: 'done',
    message: 'Render completo',
    detail: { url: result.url, durationSec: totalSec },
  });

  return result;
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

/** Devuelve el último render persistido del proyecto (o null si no existe). */
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
