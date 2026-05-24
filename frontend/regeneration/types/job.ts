/**
 * RegenJob — una tarea de regeneración encolada.
 *
 * Cada job apunta a UN target (captions/music/transitions/overlays/effects/
 * camera/scene/voice/sfx) de UNA escena. Múltiples jobs pueden ejecutarse
 * en serie (default) o en paralelo según el config del runner.
 */

export type RegenTarget =
  | 'captions'
  | 'camera'
  | 'transitions'
  | 'overlays'
  | 'effects'
  | 'sfx'
  | 'voice'
  | 'music'
  | 'scene';

export type RegenStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface RegenJob {
  id: string;
  sceneId: string;
  /** Nombre legible de la escena en el momento de encolar (cache para UI). */
  sceneName: string;
  sceneNumber: number;
  target: RegenTarget;
  /** Opciones opcionales del regenerator (ej. stylePackId, captionStyleId…). */
  options?: Record<string, unknown>;
  status: RegenStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Intentos hechos (1 = primera vez; 2+ = retry). */
  attempts: number;
  error?: string;
  /** Mensaje de progreso/log para mostrar en la UI. */
  message?: string;
}

export interface TargetMeta {
  id: RegenTarget;
  label: string;
  emoji: string;
  description: string;
}

/** Catálogo de targets para la UI — orden de aparición en menús. */
export const TARGET_METAS: TargetMeta[] = [
  { id: 'captions', label: 'Captions', emoji: '💬', description: 'Re-segmenta y re-estiliza los subtítulos.' },
  { id: 'camera', label: 'Cámara', emoji: '🎥', description: 'Elige cámara basada en emoción + keywords.' },
  { id: 'transitions', label: 'Transición', emoji: '🌫️', description: 'Re-calcula la transición de entrada.' },
  { id: 'overlays', label: 'Overlays', emoji: '✨', description: 'Re-aplica overlays del style pack activo.' },
  { id: 'effects', label: 'Efectos', emoji: '⚡', description: 'Reinyecta efectos según el style pack.' },
  { id: 'sfx', label: 'SFX', emoji: '💥', description: 'Re-elige SFX por emoción + transición + rol.' },
  { id: 'voice', label: 'Voz', emoji: '🎙️', description: 'Re-sincroniza el word-timing de los captions.' },
  { id: 'music', label: 'Música', emoji: '🎵', description: 'Añade/reemplaza pista de música de fondo.' },
  { id: 'scene', label: 'Escena entera', emoji: '🪄', description: 'Re-aplica todo el style pack a esta escena.' },
];
