/**
 * Catálogo de transiciones disponibles.
 *
 * Cada preset describe un kind (que el render conoce) y su duración por
 * defecto. El render Remotion y el de ffmpeg saben mapear los kinds más
 * comunes (cut, fade); los más exóticos (whip, glitch) requieren la
 * implementación en el engine de render correspondiente.
 */

export interface TransitionPreset {
  id: string;
  label: string;
  description: string;
  kind: string;
  defaultDurationFrames: number;
  /** Aproximación de "energía" 0..1 (cuán abrupta es). */
  energy: number;
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'cut', label: 'Cut', description: 'Sin transición.', kind: 'cut', defaultDurationFrames: 0, energy: 0.8 },
  { id: 'fade', label: 'Fade', description: 'Fundido a negro suave.', kind: 'fade', defaultDurationFrames: 8, energy: 0.2 },
  { id: 'whip', label: 'Whip pan', description: 'Movimiento horizontal rápido.', kind: 'whip', defaultDurationFrames: 6, energy: 0.9 },
  { id: 'slide-left', label: 'Slide left', description: 'Desplaza hacia la izquierda.', kind: 'slide-left', defaultDurationFrames: 10, energy: 0.6 },
  { id: 'slide-up', label: 'Slide up', description: 'Desplaza hacia arriba.', kind: 'slide-up', defaultDurationFrames: 10, energy: 0.6 },
  { id: 'zoom-in', label: 'Zoom in', description: 'Acercamiento explosivo.', kind: 'zoom-in', defaultDurationFrames: 8, energy: 0.85 },
  { id: 'glitch', label: 'Glitch', description: 'Corte con artefactos digitales.', kind: 'glitch', defaultDurationFrames: 5, energy: 1.0 },
  { id: 'flash', label: 'Flash', description: 'Frame blanco intermedio.', kind: 'flash', defaultDurationFrames: 4, energy: 0.95 },
];

export function getTransition(id: string): TransitionPreset {
  return TRANSITION_PRESETS.find((t) => t.id === id) ?? TRANSITION_PRESETS[0];
}
