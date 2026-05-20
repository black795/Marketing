import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'assets', 'output');

/** URL pública (servida por express.static) bajo la cual los .mp4 son accesibles. */
const PUBLIC_BASE_URL =
  process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';

export interface PersistedVideo {
  /** Path absoluto en disco. */
  absolutePath: string;
  /** Ruta relativa servida estáticamente, ej. /assets/output/p1/videos/scene_01.mp4 */
  staticPath: string;
  /** URL completa (con host). */
  url: string;
}

/**
 * Descarga `videoUrl` a `assets/output/<projectId>/videos/scene_<NN>.mp4`.
 * Devuelve los paths resultantes. Lanza error si la descarga falla.
 *
 * El caller decide qué hacer con el fallo — típicamente, loggea y devuelve
 * la URL temporal de Replicate al cliente igualmente.
 */
export async function persistVideo(params: {
  videoUrl: string;
  projectId: string | null;
  sceneNumber: number;
}): Promise<PersistedVideo> {
  const projectId = (params.projectId ?? 'default').replace(/[^\w\-.]/g, '_');
  const sceneFile = `scene_${String(params.sceneNumber).padStart(2, '0')}.mp4`;

  const dir = path.join(OUTPUT_ROOT, projectId, 'videos');
  await mkdir(dir, { recursive: true });

  const absolutePath = path.join(dir, sceneFile);

  const resp = await fetch(params.videoUrl);
  if (!resp.ok || !resp.body) {
    throw new Error(
      `Persist: download failed for scene ${params.sceneNumber}: HTTP ${resp.status}`
    );
  }

  await pipeline(
    Readable.fromWeb(resp.body as any),
    createWriteStream(absolutePath)
  );

  const staticPath = `/assets/output/${projectId}/videos/${sceneFile}`;
  return {
    absolutePath,
    staticPath,
    url: `${PUBLIC_BASE_URL}${staticPath}`,
  };
}

export { OUTPUT_ROOT, PROJECT_ROOT };
