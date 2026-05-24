/**
 * Render cache — un MP4 por escena indexado por hash de contenido.
 *
 * Pipeline incremental:
 *
 *   1. Para cada escena del proyecto, compute `sceneHash(scene, config)`.
 *   2. Path esperado: `<projectDir>/render-cache/scene-<sceneId>-<hash>.mp4`.
 *   3. Si existe → reusar (cache hit).
 *   4. Si no → renderizar el segmento y guardar.
 *   5. Concat de todos los segmentos en orden → MP4 intermedio.
 *
 * Cambiar `durationFrames`, `assets[].src`, o cualquier campo que afecte el
 * píxel cambia el hash. Cambiar `name`, `prompt` o `notes` NO afecta el hash
 * (no cambian el bitmap). El cache vive aparte por proyecto y por preset.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ExportPreset } from './render-presets';

/** Subset de Scene que afecta al render del segmento (no traemos el tipo completo desde frontend). */
export interface CacheableSceneShape {
  id: string;
  sceneNumber: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  assets: Array<{ kind: string; src: string | null }>;
  effects: Array<{ kind: string; params: Record<string, unknown> }>;
  camera?: unknown;
  transition?: unknown;
}

export interface CacheTarget {
  width: number;
  height: number;
  fps: number;
  crf: number;
  preset: string;
}

/**
 * Hash determinista del segmento. Sólo entran campos que afectan al output
 * visual del scene en aislamiento (sin captions ni concat).
 */
export function sceneHash(scene: CacheableSceneShape, target: CacheTarget): string {
  const payload = {
    src: scene.assets.find((a) => a.kind === 'video' || a.kind === 'image')?.src ?? null,
    duration: scene.durationFrames,
    effects: scene.effects.map((e) => ({ kind: e.kind, params: e.params })),
    camera: scene.camera,
    target,
  };
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12);
}

export function cachedSegmentPath(
  projectDir: string,
  sceneId: string,
  hash: string
): string {
  // Sanitizamos el id para path seguro.
  const safe = sceneId.replace(/[^\w\-.]/g, '_');
  return path.join(projectDir, 'render-cache', `scene-${safe}-${hash}.mp4`);
}

export function isCached(absPath: string): boolean {
  try {
    const stat = fs.statSync(absPath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Limpia segmentos del cache que ya no se usan (hash distinto al actual).
 * Mantiene `keep` más recientes para volver a vistas previas anteriores rápido.
 */
export function pruneCache(projectDir: string, keepPaths: Set<string>, keep = 30): void {
  const dir = path.join(projectDir, 'render-cache');
  if (!fs.existsSync(dir)) return;
  const entries = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('scene-') && f.endsWith('.mp4'))
    .map((f) => {
      const abs = path.join(dir, f);
      const stat = fs.statSync(abs);
      return { abs, mtime: stat.mtimeMs };
    })
    .filter((e) => !keepPaths.has(e.abs))
    .sort((a, b) => b.mtime - a.mtime); // más nuevos primero

  for (const e of entries.slice(keep)) {
    try {
      fs.unlinkSync(e.abs);
    } catch {
      /* ignore */
    }
  }
}

export interface ExportTargetFromPreset {
  width: number;
  height: number;
  fps: number;
  crf: number;
  preset: ExportPreset['preset'];
}

export function targetFromPreset(p: ExportPreset): ExportTargetFromPreset {
  return {
    width: p.width,
    height: p.height,
    fps: p.fps,
    crf: p.crf,
    preset: p.preset,
  };
}
