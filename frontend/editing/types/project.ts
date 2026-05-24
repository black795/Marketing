/**
 * TimelineProject — el documento global del editor.
 *
 * Contiene scenes (scene graph), tracks (pistas paralelas), stylePreset,
 * renderConfig y metadata. Se persiste como `editing-project.json` en disco,
 * en PARALELO al `timeline.json` legacy (ambos coexisten — el render aún usa
 * el legacy hasta que migremos su pipeline).
 *
 * El doc es 100% derivable del estado actual del proyecto (TimelineDocument
 * + EditPlan + Scenes), por lo que se puede regenerar si se pierde.
 */
import type { Scene } from './scene';
import type { Track } from './tracks';

/** Preset visual aplicado al proyecto — sirve a captions, transitions, paleta. */
export interface StylePreset {
  id: string;
  label: string;
  description?: string;
  /** Editor sugerido (debe matchear un id del catálogo de editor-adapters). */
  suggestedEditor?: 'remotion' | 'captions';
  /** Parámetros libres (typography, colorPalette, captionStyleId, …). */
  params: Record<string, unknown>;
}

/** Configuración del render final del proyecto. */
export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  /** Trade-off velocidad vs calidad. */
  quality: 'fast' | 'medium' | 'high';
  /** Quemar captions sobre el video (libass). */
  burnCaptions: boolean;
  /** crf 18..28 (ffmpeg). Opcional — el render aplica defaults razonables. */
  crf?: number;
  /** Bitrate de audio en kbps. */
  audioBitrateKbps?: number;
}

/** El documento del proyecto editable. */
export interface TimelineProject {
  version: 1;
  /** Mismo id que usamos en disco (`assets/output/<projectId>`). */
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Escenas ordenadas — el orden visible. `sceneNumber` preserva el original. */
  scenes: Scene[];
  /** Pistas globales (mute/solo/lock por pista). */
  tracks: Track[];
  /** Preset visual global. null = sin preset. */
  stylePreset: StylePreset | null;
  /** Configuración del render. */
  renderConfig: RenderConfig;
  metadata: {
    source: 'scripts' | 'avatar' | 'manual' | 'derived';
    sceneCount: number;
    /** true si el proyecto se derivó de un timeline.json legacy. */
    derivedFromLegacy: boolean;
    /** Duración total en frames (suma de escenas incluidas). */
    durationFrames: number;
  };
}

/** Estado UI del editor — engloba el proyecto + la interacción. */
export interface EditingProject {
  project: TimelineProject;
  /** id de la escena seleccionada en la UI (null = ninguna). */
  selectedSceneId: string | null;
  /** Vista activa del editor. */
  activeView: 'storyboard' | 'timeline' | 'render';
  /** Historial para undo/redo. Las fases futuras lo poblarán. */
  history: {
    past: TimelineProject[];
    future: TimelineProject[];
  };
}
