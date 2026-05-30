/**
 * Pipeline secuencial del editor — Ola 1 de la refactorización.
 *
 * El editor deja de ser un selector de 6 cards aisladas y pasa a ser un
 * flujo lineal: Setup → Import → Storyboard → Timeline → Style → Captions →
 * (AI Assistant) → Export. Cada fase se persiste dentro del campo `pipeline`
 * del `editing-project.json` (el backend lo trata opaco — ver
 * backend/src/services/editing-project.ts).
 *
 * En esta Ola NO se modela aún Scene Memory ni AI Assistant — sólo el shell
 * secuencial y el setup/import. Las fases 3-8 son embebimientos de los
 * módulos que ya existen (Storyboard, Timeline, Style, Captions, Export).
 */

/** Cada paso del wizard, en el orden visible. */
export const PHASES = ['auto', 'import', 'storyboard', 'assemble', 'subtitles'] as const;

export type Phase = (typeof PHASES)[number];

/** Tipo de contenido — gobierna defaults de duración/formato/estilo. */
export const CONTENT_TYPES = [
  'cinematic',
  'shorts',
  'reels',
  'documentary',
  'storytelling',
  'gaming',
  'podcast',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Editor de destino. Se decide acá y los pasos posteriores lo respetan. */
export const EDITOR_TARGETS = ['remotion', 'captions', 'both'] as const;
export type EditorTarget = (typeof EDITOR_TARGETS)[number];

/** Ratio de aspecto soportado por el pipeline de render. */
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** Configuración inicial del proyecto. Se llena en SetupPhase. */
export interface PipelineSetup {
  name: string;
  contentType: ContentType;
  editorTarget: EditorTarget;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  fps: 24 | 30 | 60;
  /** Estilo global libre — guía al storyboard / style engine. */
  globalStyle: string;
}

/**
 * Bolsa de IDs de assets seleccionados en ImportPhase. Los assets en sí
 * viven en disco bajo `output/<projectId>/...` — acá guardamos sólo qué se
 * importó y en qué grupo cae cada uno.
 */
export interface PipelineImports {
  /** IDs por categoría — el formato del id depende del listado del backend. */
  scriptIds: string[];
  sceneIds: string[];
  imageIds: string[];
  videoIds: string[];
  audioIds: string[];
  voiceoverIds: string[];
  musicIds: string[];
  referenceIds: string[];
  promptIds: string[];
}

/**
 * Marca por fase: si el usuario ya "tocó" la fase (la vio + interactuó), se
 * habilita Continue y se considera completada para el stepper. Las fases
 * embebidas (storyboard/timeline/...) las marcamos como tocadas al primer
 * render — son herramientas, no formularios, así que no podemos validar.
 */
export type PhaseStatus = 'pending' | 'visited' | 'completed' | 'skipped';

export interface PipelineState {
  /** Fase activa en este momento. */
  currentPhase: Phase;
  /** Marca por fase. */
  status: Record<Phase, PhaseStatus>;
  setup: PipelineSetup;
  imports: PipelineImports;
  /** Última vez que el pipeline se guardó (ISO). */
  updatedAt?: string;
}

export const DEFAULT_SETUP: PipelineSetup = {
  name: '',
  contentType: 'reels',
  editorTarget: 'both',
  aspectRatio: '9:16',
  durationSeconds: 30,
  fps: 30,
  globalStyle: '',
};

export const DEFAULT_IMPORTS: PipelineImports = {
  scriptIds: [],
  sceneIds: [],
  imageIds: [],
  videoIds: [],
  audioIds: [],
  voiceoverIds: [],
  musicIds: [],
  referenceIds: [],
  promptIds: [],
};

export const DEFAULT_PHASE_STATUS: Record<Phase, PhaseStatus> = {
  auto: 'pending',
  import: 'pending',
  storyboard: 'pending',
  assemble: 'pending',
  subtitles: 'pending',
};

export const DEFAULT_PIPELINE: PipelineState = {
  currentPhase: 'auto',
  status: DEFAULT_PHASE_STATUS,
  setup: DEFAULT_SETUP,
  imports: DEFAULT_IMPORTS,
};

/** Etiqueta visible de cada fase — usada por PipelineStepper. */
export const PHASE_LABEL: Record<Phase, string> = {
  auto: '0 · Auto (IA)',
  import: '1 · Importar',
  storyboard: '2 · Storyboard',
  assemble: '3 · Junte de clips',
  subtitles: '4 · Subtítulos',
};

/** Subtítulo descriptivo opcional para el header de cada fase. */
export const PHASE_HINT: Record<Phase, string> = {
  auto: 'Describí qué video querés en una frase. La IA arma el junte y los subtítulos.',
  import: 'Galería de los archivos importados: videos, imágenes y audio.',
  storyboard: 'Dirige las escenas: prompts, regen IA, drag & drop, versionado.',
  assemble: 'Especifica el orden y junta los clips con Remotion.',
  subtitles: 'Agrega texto y duración por subtítulo, elegí un estilo y renderizá.',
};

export function nextPhase(p: Phase): Phase | null {
  const idx = PHASES.indexOf(p);
  if (idx < 0 || idx === PHASES.length - 1) return null;
  return PHASES[idx + 1];
}

export function prevPhase(p: Phase): Phase | null {
  const idx = PHASES.indexOf(p);
  if (idx <= 0) return null;
  return PHASES[idx - 1];
}

/** Mínimo para considerar válido el setup. Se mantiene exportado por compat. */
export function isSetupValid(s: PipelineSetup): boolean {
  return (
    s.name.trim().length > 0 &&
    s.durationSeconds > 0 &&
    s.fps > 0
  );
}
