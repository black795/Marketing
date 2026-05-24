/**
 * Tipos específicos del Storyboard UI — separados de los tipos de dominio
 * (que viven en `editing/types`). Aquí va lo que sólo importa al editor visual:
 * pestañas del sidebar, estado de drag, modos de edición rápida, etc.
 */

export type SidebarTab =
  | 'images'
  | 'videos'
  | 'voices'
  | 'overlays'
  | 'music'
  | 'captions'
  | 'sfx';

export interface SidebarTabMeta {
  id: SidebarTab;
  label: string;
  emoji: string;
  /** Texto cuando no hay nada del tipo en el proyecto. */
  emptyHint: string;
}

export const SIDEBAR_TABS: SidebarTabMeta[] = [
  { id: 'images', label: 'Imágenes', emoji: '🖼️', emptyHint: 'Aún no hay imágenes generadas.' },
  { id: 'videos', label: 'Videos', emoji: '🎞️', emptyHint: 'Aún no hay videos generados.' },
  { id: 'voices', label: 'Voces', emoji: '🎙️', emptyHint: 'Sin voiceovers en este proyecto.' },
  { id: 'overlays', label: 'Overlays', emoji: '✨', emptyHint: 'Añade textos, stickers o logos.' },
  { id: 'music', label: 'Música', emoji: '🎵', emptyHint: 'Sin pista musical asignada.' },
  { id: 'captions', label: 'Captions', emoji: '💬', emptyHint: 'Sin subtítulos en el timeline.' },
  { id: 'sfx', label: 'SFX', emoji: '💥', emptyHint: 'Sin efectos de sonido todavía.' },
];

/** Estado transitorio del drag & drop entre cards. */
export interface DragState {
  /** id de la escena que se está arrastrando. */
  draggingSceneId: string | null;
  /** índice destino sobre el que está hover. -1 si fuera de cualquier card. */
  overIndex: number;
}

/** Estado del autosave para feedback en la UI. */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Etiquetas humanas para el estado de render de una escena (UI). */
export type SceneStatusUi =
  | 'generating'
  | 'regenerating'
  | 'rendered'
  | 'modified'
  | 'failed'
  | 'pending';
