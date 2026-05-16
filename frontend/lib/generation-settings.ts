// Configuración de generación — fuente única de opciones, defaults y helpers.
// Editar aquí cambia la UI y la validación sin tocar componentes.

export type SceneCount = number;
export type QualityProfile = 'draft' | 'standard' | 'high' | 'ultra';
export type AspectRatioOption =
  | '1:1'
  | '9:16'
  | '16:9'
  | '4:5'
  | '3:4'
  | '4:3'
  | '2:3'
  | '3:2';

export interface GenerationSettings {
  sceneCount: SceneCount;
  quality: QualityProfile;
  aspectRatio: AspectRatioOption;
}

export interface SceneCountOption {
  value: SceneCount;
  label: string;
}

export interface QualityProfileOption {
  value: QualityProfile;
  label: string;
  description: string;
  /** Tier de resolución equivalente para nano-banana-pro */
  resolutionTier: '1K' | '2K' | '4K';
  /** Mapeo a gpt-image-2 */
  gptImageQuality: 'low' | 'medium' | 'high';
}

export interface AspectRatioMetadata {
  value: AspectRatioOption;
  label: string;
  description: string;
  /** width/height para preview */
  ratio: [number, number];
}

export const SCENE_COUNT_OPTIONS: SceneCountOption[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 10, label: '10' },
];

export const QUALITY_OPTIONS: QualityProfileOption[] = [
  {
    value: 'draft',
    label: 'Draft',
    description: 'Rápido y barato. 1K, compresión alta. Ideal para iterar.',
    resolutionTier: '1K',
    gptImageQuality: 'low',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Balance entre velocidad y nitidez. 2K, compresión media.',
    resolutionTier: '2K',
    gptImageQuality: 'medium',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Más detalle y mejor texto. 2K png, compresión baja.',
    resolutionTier: '2K',
    gptImageQuality: 'high',
  },
  {
    value: 'ultra',
    label: 'Ultra',
    description: 'Máxima fidelidad. 4K cuando el modelo lo soporta.',
    resolutionTier: '4K',
    gptImageQuality: 'high',
  },
];

export const ASPECT_RATIO_OPTIONS: AspectRatioMetadata[] = [
  {
    value: '9:16',
    label: '9:16',
    description: 'Vertical · Reels, TikTok, Stories',
    ratio: [9, 16],
  },
  {
    value: '1:1',
    label: '1:1',
    description: 'Cuadrado · feed clásico',
    ratio: [1, 1],
  },
  {
    value: '4:5',
    label: '4:5',
    description: 'Vertical suave · post IG',
    ratio: [4, 5],
  },
  {
    value: '3:4',
    label: '3:4',
    description: 'Vertical · portrait',
    ratio: [3, 4],
  },
  {
    value: '4:3',
    label: '4:3',
    description: 'Horizontal suave',
    ratio: [4, 3],
  },
  {
    value: '3:2',
    label: '3:2',
    description: 'Horizontal · DSLR',
    ratio: [3, 2],
  },
  {
    value: '16:9',
    label: '16:9',
    description: 'Widescreen · YouTube, web',
    ratio: [16, 9],
  },
];

// Algunos modelos (gpt-image-2) no soportan 4:5; mapeamos a 3:4 ahí.
// Esa traducción vive en el worker; aquí lo mostramos como opción válida.

export const DEFAULT_SETTINGS: GenerationSettings = {
  sceneCount: 6,
  quality: 'standard',
  aspectRatio: '9:16',
};

// Límites de las imágenes de referencia del personaje.
// nano-banana-pro acepta hasta 14, pero por defecto recomendamos un set
// curado que cubra frente / perfil / cuerpo / expresiones / ropa.
export const REFERENCE_LIMITS = {
  max: 10,
  recommended: 5,
  /** Lado máximo en píxeles tras el resize cliente (acelera el upload). */
  maxSidePx: 1280,
  /** Tamaño máximo del archivo original aceptado (bytes). */
  maxBytes: 12 * 1024 * 1024,
} as const;

const SCENE_COUNT_VALUES = new Set(SCENE_COUNT_OPTIONS.map((o) => o.value));
const QUALITY_VALUES = new Set(QUALITY_OPTIONS.map((o) => o.value));
const ASPECT_VALUES = new Set(ASPECT_RATIO_OPTIONS.map((o) => o.value));

export function isSceneCount(n: number): n is SceneCount {
  return SCENE_COUNT_VALUES.has(n);
}

export function isQualityProfile(s: string): s is QualityProfile {
  return QUALITY_VALUES.has(s as QualityProfile);
}

export function isAspectRatio(s: string): s is AspectRatioOption {
  return ASPECT_VALUES.has(s as AspectRatioOption);
}

export function describeQuality(q: QualityProfile): string {
  return QUALITY_OPTIONS.find((o) => o.value === q)?.description ?? '';
}

export function describeAspectRatio(a: AspectRatioOption): string {
  return ASPECT_RATIO_OPTIONS.find((o) => o.value === a)?.description ?? '';
}
