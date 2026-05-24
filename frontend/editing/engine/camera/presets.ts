/**
 * Catálogo de presets de cámara virtual.
 *
 * Cada preset describe el movimiento que se aplicará al clip principal de
 * la escena (pan + zoom + easing). El render (Remotion / ffmpeg con
 * zoompan) traduce el preset a la transformación concreta.
 */
import type { SceneCamera } from '../../types/scene';

export interface CameraPreset {
  id: string;
  label: string;
  description: string;
  /** SceneCamera resultante al aplicar este preset. */
  toSceneCamera(): SceneCamera;
  /** Si el preset también sugiere un efecto extra (shake, etc.). */
  extraEffect?: { kind: string; params: Record<string, unknown> };
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'static',
    label: 'Estática',
    description: 'Sin movimiento — talking head, podcasts, plano fijo.',
    toSceneCamera: () => ({
      preset: 'static',
      easing: 'linear',
    }),
  },
  {
    id: 'ken-burns',
    label: 'Ken Burns',
    description: 'Zoom-in muy lento + pan suave. Documental / cinemático.',
    toSceneCamera: () => ({
      preset: 'ken-burns',
      zoom: { from: 1.0, to: 1.08 },
      pan: { fromX: 0, toX: 0.02, fromY: 0, toY: 0.02 },
      easing: 'ease-in-out',
    }),
  },
  {
    id: 'slow-zoom',
    label: 'Slow zoom',
    description: 'Zoom-in lento de 1.0x a 1.1x, sin pan.',
    toSceneCamera: () => ({
      preset: 'slow-zoom',
      zoom: { from: 1.0, to: 1.1 },
      easing: 'ease-in-out',
    }),
  },
  {
    id: 'punch-in-soft',
    label: 'Punch-in soft',
    description: 'Push-in moderado, easing rápido. Refuerzo discreto.',
    toSceneCamera: () => ({
      preset: 'punch-in-soft',
      zoom: { from: 1.0, to: 1.15 },
      easing: 'ease-out',
    }),
  },
  {
    id: 'punch-zoom',
    label: 'Punch zoom',
    description: 'Zoom agresivo 1.0 → 1.35, easing brusco. Reacciones.',
    toSceneCamera: () => ({
      preset: 'punch-zoom',
      zoom: { from: 1.0, to: 1.35 },
      easing: 'ease-out',
    }),
  },
  {
    id: 'cinematic-push',
    label: 'Cinematic push',
    description: 'Push-in elegante 1.0 → 1.2 con pan a la izquierda.',
    toSceneCamera: () => ({
      preset: 'cinematic-push',
      zoom: { from: 1.0, to: 1.2 },
      pan: { fromX: 0, toX: -0.04, fromY: 0, toY: 0 },
      easing: 'ease-in-out',
    }),
  },
  {
    id: 'shake',
    label: 'Shake',
    description: 'Cámara temblando — urgencia / acción.',
    toSceneCamera: () => ({
      preset: 'shake',
      easing: 'linear',
    }),
    extraEffect: { kind: 'shake', params: { intensity: 0.6, frequency: 8 } },
  },
  {
    id: 'face-track',
    label: 'Face tracking',
    description: 'Reframe automático siguiendo el rostro detectado.',
    toSceneCamera: () => ({
      preset: 'face-track',
      easing: 'ease-in-out',
    }),
    extraEffect: { kind: 'face-track', params: { padding: 0.15 } },
  },
];

export function getCameraPreset(id: string): CameraPreset {
  return CAMERA_PRESETS.find((p) => p.id === id) ?? CAMERA_PRESETS[0];
}
