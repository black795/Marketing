/**
 * Presets de exportación — perfil por plataforma destino.
 *
 * Cada uno define dimensiones, fps, bitrate/crf, codec y duración máxima
 * (informativa; el render no la enforce, sólo la usa como advertencia).
 *
 * El render llama `getExportPreset(id)` y aplica el resultado por encima
 * del `renderConfig` del proyecto. Si el `id` es desconocido o null, usa el
 * config del proyecto sin tocarlo.
 */

export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface ExportPreset {
  id: string;
  label: string;
  emoji: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'linkedin' | 'facebook' | 'square' | 'landscape';
  aspect: AspectRatio;
  width: number;
  height: number;
  fps: number;
  /** Compression Rate Factor para libx264 — 18 high, 23 medium, 28 fast. */
  crf: number;
  /** Preset libx264. */
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow';
  /** Bitrate de audio en kbps. */
  audioKbps: number;
  /** Duración máxima recomendada en segundos (0 = sin límite). */
  maxDurationSec: number;
  description: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    emoji: '🎵',
    platform: 'tiktok',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    crf: 21,
    preset: 'fast',
    audioKbps: 192,
    maxDurationSec: 60,
    description: '9:16 vertical · 1080×1920 · ≤60s · MP4 H.264.',
  },
  {
    id: 'reels',
    label: 'Instagram Reels',
    emoji: '📸',
    platform: 'instagram',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    crf: 20,
    preset: 'medium',
    audioKbps: 192,
    maxDurationSec: 90,
    description: '9:16 vertical · 1080×1920 · ≤90s · calidad alta.',
  },
  {
    id: 'shorts',
    label: 'YouTube Shorts',
    emoji: '▶️',
    platform: 'youtube',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    crf: 19,
    preset: 'medium',
    audioKbps: 192,
    maxDurationSec: 60,
    description: '9:16 vertical · 1080×1920 · ≤60s · calidad muy alta.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Video',
    emoji: '💼',
    platform: 'linkedin',
    aspect: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    crf: 22,
    preset: 'medium',
    audioKbps: 192,
    maxDurationSec: 600,
    description: '16:9 horizontal · 1920×1080 · ≤10min · compresión media.',
  },
  {
    id: 'facebook',
    label: 'Facebook Reels',
    emoji: '📘',
    platform: 'facebook',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    crf: 21,
    preset: 'fast',
    audioKbps: 192,
    maxDurationSec: 90,
    description: '9:16 vertical · 1080×1920 · ≤90s · compatible con feed.',
  },
  {
    id: 'square',
    label: 'Square 1:1',
    emoji: '⬜',
    platform: 'square',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    fps: 30,
    crf: 21,
    preset: 'fast',
    audioKbps: 192,
    maxDurationSec: 60,
    description: '1:1 cuadrado · 1080×1080 · para carrusel/feed Instagram.',
  },
  {
    id: 'landscape',
    label: 'Landscape 16:9',
    emoji: '🖥️',
    platform: 'landscape',
    aspect: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    crf: 20,
    preset: 'medium',
    audioKbps: 192,
    maxDurationSec: 0,
    description: '16:9 estándar · 1920×1080 · genérico para YouTube/web.',
  },
];

export function getExportPreset(id: string | null | undefined): ExportPreset | null {
  if (!id) return null;
  return EXPORT_PRESETS.find((p) => p.id === id) ?? null;
}
