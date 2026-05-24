/**
 * Espejo de los presets del backend con metadata extra de UI (color, icon).
 *
 * El array LOCAL_EXPORT_PRESETS sirve para que la página de Export pinte
 * las cards SIN tener que hacer fetch al backend en el primer paint. El
 * `listExportPresets()` real refresca al montar.
 */
import type { BackendExportPreset } from '../queue/api';

export const LOCAL_EXPORT_PRESETS: BackendExportPreset[] = [
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
    description: '1:1 cuadrado · 1080×1080 · carrusel/feed Instagram.',
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
    description: '16:9 estándar · 1920×1080 · YouTube/web.',
  },
];

export function aspectClassName(aspect: '9:16' | '1:1' | '16:9'): string {
  if (aspect === '9:16') return 'aspect-[9/16]';
  if (aspect === '1:1') return 'aspect-square';
  return 'aspect-video';
}
