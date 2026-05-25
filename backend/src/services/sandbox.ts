/**
 * Sandbox / mock mode — Fase E.
 *
 * Cuando está ON, los workers caros (image / video / avatar) NO llaman a
 * Replicate. Devuelven placeholders deterministas:
 *
 *  - imágenes  → SVG inline como data: URL (sin disco, sin red)
 *  - videos    → mp4 generado con ffmpeg, cacheado en assets/sandbox/
 *  - avatares  → mismo mp4 que video
 *
 * Objetivo: probar el pipeline completo (storyboard → timeline → render)
 * sin consumir cuota de Replicate. La paleta y la duración salen
 * deterministas de un seed para que el mismo prompt produzca el mismo
 * placeholder y el editor pueda razonar con continuidad.
 *
 * Activación
 * ----------
 *  - Persistente: PUT /api/sandbox/status  { enabled: true }
 *    Se guarda en backend/.sandbox-state.json y queda activo entre reinicios.
 *  - Forzado por entorno: SANDBOX_MODE=1  (no se puede desactivar via API)
 *  - Override puntual por request: header `x-sandbox: 1` o `x-sandbox: 0`
 *
 * Importante: el cache lee/escribe sincrónico desde los workers, que no
 * tienen acceso al Request. Por eso el estado se mantiene en memoria + JSON,
 * y los routes pueden además leer el header para overrides one-shot.
 */
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Request } from 'express';
import { createLogger } from './logger';

const log = createLogger('sandbox');

const STATE_FILE = path.resolve(__dirname, '..', '..', '.sandbox-state.json');
const PLACEHOLDER_DIR = path.resolve(__dirname, '..', '..', '..', 'assets', 'sandbox');

/** Paletas Tim Koda — primer color es bg, segundo es acento. */
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#FF2D8A', '#FFF466'], // pink + yellow (brand primary)
  ['#0EA5E9', '#FACC15'], // cyan + amber
  ['#7C3AED', '#FB7185'], // violet + rose
  ['#10B981', '#FDE68A'], // emerald + cream
  ['#F97316', '#0F172A'], // orange + slate
  ['#EC4899', '#A7F3D0'], // hot pink + mint
];

export interface SandboxState {
  enabled: boolean;
  updatedAt: string;
  source: 'env' | 'file' | 'default';
}

// ----------- Estado en memoria (sync) -----------

let state: SandboxState = { enabled: false, updatedAt: new Date(0).toISOString(), source: 'default' };
let loaded = false;

function loadStateSync(): SandboxState {
  if (loaded) return state;
  loaded = true;

  const envForce = (process.env.SANDBOX_MODE || '').trim().toLowerCase();
  if (envForce === '1' || envForce === 'true' || envForce === 'on') {
    state = { enabled: true, updatedAt: new Date().toISOString(), source: 'env' };
    log.info('sandbox ENABLED por env SANDBOX_MODE');
    return state;
  }

  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SandboxState>;
      state = {
        enabled: Boolean(parsed.enabled),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        source: 'file',
      };
    }
  } catch (err) {
    log.warn(`no se pudo leer ${STATE_FILE}: ${(err as Error).message}`);
  }
  return state;
}

export function getSandboxState(): SandboxState {
  return loadStateSync();
}

/** True si el sandbox está activo. Acepta un Request para honrar el header `x-sandbox`. */
export function isSandboxEnabled(req?: Request): boolean {
  if (req) {
    const header = req.header('x-sandbox');
    if (header !== undefined) {
      const v = header.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 'on') return true;
      if (v === '0' || v === 'false' || v === 'off') return false;
    }
  }
  return loadStateSync().enabled;
}

export async function setSandboxEnabled(enabled: boolean): Promise<SandboxState> {
  const current = loadStateSync();
  if (current.source === 'env') {
    // SANDBOX_MODE en .env tiene prioridad — no permitimos apagarlo via API.
    log.warn('intento de cambiar sandbox via API ignorado: SANDBOX_MODE env tiene prioridad');
    return current;
  }
  state = { enabled, updatedAt: new Date().toISOString(), source: 'file' };
  loaded = true;
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    log.info(`sandbox ${enabled ? 'ENABLED 🧪' : 'disabled'} (persistido)`);
  } catch (err) {
    log.error(`no se pudo persistir sandbox state: ${(err as Error).message}`);
  }
  return state;
}

// ----------- Placeholders de imagen (SVG inline) -----------

export interface PlaceholderImageOptions {
  prompt: string;
  aspectRatio?: string;
  /** Clave estable para color (p.ej. sceneId). Si falta, se hashea el prompt. */
  seedKey?: string;
  /** Etiqueta visible en el placeholder (p.ej. "Escena 3"). */
  label?: string;
}

/** Devuelve un data: URL con un SVG editorial usando la paleta de marca. */
export function placeholderImage(opts: PlaceholderImageOptions): string {
  const ar = opts.aspectRatio ?? '9:16';
  const [w, h] = aspectToSize(ar, 1080);
  const seed = Math.abs(hashString(opts.seedKey ?? opts.prompt));
  const [bg, fg] = PALETTE[seed % PALETTE.length];
  const prompt = (opts.prompt ?? '').trim();
  const shortPrompt = prompt.length > 140 ? prompt.slice(0, 137) + '…' : prompt;
  const label = opts.label ?? '🧪 SANDBOX';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${bg}"/>` +
    `<stop offset="100%" stop-color="${shade(bg, -28)}"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<rect x="${w * 0.06}" y="${h * 0.06}" width="${w * 0.88}" height="${h * 0.88}" ` +
    `fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="${Math.round(h * 0.004)}"/>` +
    `<g font-family="-apple-system, Inter, Helvetica, sans-serif" fill="${fg}" text-anchor="middle">` +
    `<text x="50%" y="${h * 0.46}" font-size="${Math.round(h * 0.055)}" font-weight="800">${escapeXml(label)}</text>` +
    `<text x="50%" y="${h * 0.54}" font-size="${Math.round(h * 0.022)}" opacity="0.88">${escapeXml(shortPrompt)}</text>` +
    `<text x="50%" y="${h * 0.96}" font-size="${Math.round(h * 0.018)}" opacity="0.55">tim koda · mock</text>` +
    `</g>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ----------- Placeholders de video (mp4 cacheado vía ffmpeg) -----------

export interface PlaceholderVideoOptions {
  prompt: string;
  aspectRatio?: string;
  durationSec?: number;
  seedKey?: string;
  /** Base URL pública del gateway, p.ej. "http://localhost:4000". */
  publicBaseUrl: string;
}

/**
 * Devuelve una URL http servible (vía /assets/sandbox/...) a un mp4
 * placeholder. Lo genera con ffmpeg la primera vez y lo cachea por
 * (paleta, aspect ratio, duración). Si ffmpeg falla, cae al SVG.
 */
export async function placeholderVideoUrl(opts: PlaceholderVideoOptions): Promise<string> {
  const ar = opts.aspectRatio ?? '9:16';
  const dur = Math.max(1, Math.min(20, Math.round(opts.durationSec ?? 5)));
  const seed = Math.abs(hashString(opts.seedKey ?? opts.prompt));
  const paletteIdx = seed % PALETTE.length;
  const [bg] = PALETTE[paletteIdx];
  const [w, h] = aspectToSize(ar, 720);

  const fileName = `sandbox-p${paletteIdx}-${ar.replace(':', 'x')}-${dur}s.mp4`;
  const filePath = path.join(PLACEHOLDER_DIR, fileName);

  if (!existsSync(filePath)) {
    try {
      await fs.mkdir(PLACEHOLDER_DIR, { recursive: true });
      await renderPlaceholderMp4(filePath, { w, h, dur, bg });
      log.info(`placeholder mp4 generado ${fileName}`);
    } catch (err) {
      log.warn(`ffmpeg falló al generar ${fileName}: ${(err as Error).message}. Cayendo a SVG.`);
      return placeholderImage({ prompt: opts.prompt, aspectRatio: ar, seedKey: opts.seedKey });
    }
  }

  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  return `${base}/assets/sandbox/${fileName}`;
}

function renderPlaceholderMp4(
  out: string,
  p: { w: number; h: number; dur: number; bg: string }
): Promise<void> {
  // libx264 exige dimensiones pares.
  const W = Math.floor(p.w / 2) * 2;
  const H = Math.floor(p.h / 2) * 2;
  const colorHex = p.bg.replace('#', '');

  // Fondo color sólido + caja blanca pulsante en el centro. Sin drawtext
  // (depende de fontconfig y en Windows no es portable). El frontend
  // dibuja la etiqueta "SANDBOX" arriba del video como overlay.
  const filter =
    `format=yuv420p,` +
    `drawbox=x=(iw-iw/3)/2:y=(ih-ih/3)/2:w=iw/3:h=ih/3:color=white@0.16:t=fill,` +
    `drawbox=x=(iw-iw/2)/2:y=(ih-ih/2)/2:w=iw/2:h=ih/2:color=white@0.08:t=4`;

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x${colorHex}:s=${W}x${H}:d=${p.dur}:r=30`,
    '-vf', filter,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-movflags', '+faststart',
    out,
  ];

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

// ----------- helpers -----------

function aspectToSize(ar: string, longSide: number): [number, number] {
  const [a, b] = ar.split(':').map(Number);
  if (!a || !b) return [longSide, longSide];
  if (a >= b) return [longSide, Math.round((longSide * b) / a)];
  return [Math.round((longSide * a) / b), longSide];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shade(hex: string, pct: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const delta = Math.round((pct / 100) * 255);
  let r = ((num >> 16) & 0xff) + delta;
  let g = ((num >> 8) & 0xff) + delta;
  let b = (num & 0xff) + delta;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
