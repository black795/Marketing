// Historial de versiones por escena + presets de edición avanzada.
//
// Cada vez que el usuario regenera una escena (o restaura una versión
// previa) se agrega una entrada nueva al historial. La "versión actual"
// es siempre la que se muestra en la card y en el detail panel.

import type { Scene } from '@/types/story';

export type SceneVersionSource = 'initial' | 'edit' | 'restore';

export interface SceneVersion {
  id: string;
  scene_number: number;
  image_url: string | null;
  image_error?: string;
  image_prompt: string;
  camera: string;
  lighting: string;
  emotion: string;
  createdAt: number;
  source: SceneVersionSource;
  label?: string;
}

export type SceneHistory = Map<number, SceneVersion[]>;

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** Short, sortable id for tracing un request de regeneración en logs. */
export function makeRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function versionFromScene(
  scene: Scene,
  source: SceneVersionSource = 'initial',
  label?: string
): SceneVersion {
  return {
    id: makeId(),
    scene_number: scene.scene_number,
    image_url: scene.image_url ?? null,
    image_error: scene.image_error,
    image_prompt: scene.image_prompt,
    camera: scene.camera,
    lighting: scene.lighting,
    emotion: scene.emotion,
    createdAt: Date.now(),
    source,
    label,
  };
}

// ---------------------------------------------------------------------
// Presets para edición avanzada — fuente única, render como chips.
// ---------------------------------------------------------------------

export const CAMERA_PRESETS = [
  'iPhone candid, off-center framing',
  'wide cinematic shot, anamorphic',
  'medium close-up, shallow depth of field',
  'macro detail, 100mm lens',
  'handheld, slight motion blur',
  'static tripod, symmetrical composition',
] as const;

export const LIGHTING_PRESETS = [
  'natural side light, soft shadows',
  'warm golden hour rim light',
  'overcast diffused daylight',
  'moody single-source key light',
  'high-key bright editorial',
  'neon practicals, cyan/magenta accents',
] as const;

export const EMOTION_PRESETS = [
  'calm, contemplative',
  'confident, bold',
  'vulnerable, tender',
  'playful, lively',
  'intense, focused',
  'serene, transcendent',
] as const;

export const STYLE_PRESETS = [
  'editorial bright, anti-AI texture, lived-in',
  'cinematic film grain, 35mm',
  '3D CGI render, hyper-detail',
  'analog polaroid, faded palette',
  'high-fashion magazine, glossy',
  'documentary candid, raw',
] as const;

export interface AngleOption {
  value: string;
  label: string;
  /** Frase que se agrega al prompt si está seleccionada. */
  modifier: string;
}

export const ANGLE_OPTIONS: AngleOption[] = [
  { value: 'eye-level', label: 'Eye level', modifier: 'eye-level perspective' },
  { value: 'low-angle', label: 'Low angle', modifier: 'low-angle shot, looking up' },
  { value: 'high-angle', label: 'High angle', modifier: 'high-angle shot, looking down' },
  { value: 'dutch', label: 'Dutch tilt', modifier: 'dutch tilt, off-axis composition' },
  { value: 'overhead', label: 'Overhead', modifier: 'overhead birds-eye view' },
  { value: 'pov', label: 'POV', modifier: 'first-person POV perspective' },
  { value: 'profile', label: 'Profile', modifier: 'side profile composition' },
];

export interface IntensityLevel {
  value: number; // 0..4
  label: string;
  modifier: string | null;
}

export const INTENSITY_LEVELS: IntensityLevel[] = [
  { value: 0, label: 'Subtle', modifier: 'subtle, understated mood' },
  { value: 1, label: 'Natural', modifier: null },
  { value: 2, label: 'Cinematic', modifier: 'cinematic composition, controlled contrast' },
  {
    value: 3,
    label: 'Dramatic',
    modifier:
      'highly cinematic, dramatic lighting, deep contrast, atmospheric haze',
  },
  {
    value: 4,
    label: 'Hyper',
    modifier:
      'epic cinematic, painterly chiaroscuro, volumetric light, intense atmosphere, color grading',
  },
];

// ---------------------------------------------------------------------
// AdvancedEdit — el estado que mantiene el panel de edición.
// ---------------------------------------------------------------------

export interface AdvancedEdit {
  /** Prompt base editado por el usuario (a partir de scene.image_prompt). */
  prompt: string;
  camera: string;
  lighting: string;
  emotion: string;
  style: string;
  angle: string; // value de ANGLE_OPTIONS o ''
  intensity: number; // 0..INTENSITY_LEVELS.length-1
}

export function initialEditFromScene(scene: Scene): AdvancedEdit {
  return {
    prompt: scene.image_prompt,
    camera: scene.camera,
    lighting: scene.lighting,
    emotion: scene.emotion,
    style: '',
    angle: '',
    intensity: 1,
  };
}

/**
 * Compone el prompt final que se envía al worker.
 * El prompt base se respeta tal cual; los modificadores se concatenan
 * al final entre delimitadores claros para que el modelo los lea como
 * "direction overrides".
 */
export function composeFinalPrompt(edit: AdvancedEdit): string {
  const base = edit.prompt.trim();
  const modifiers: string[] = [];

  // Sólo agrego campos si difieren del valor por defecto / están vacíos.
  if (edit.camera.trim()) modifiers.push(`camera: ${edit.camera.trim()}`);
  if (edit.lighting.trim()) modifiers.push(`lighting: ${edit.lighting.trim()}`);
  if (edit.emotion.trim()) modifiers.push(`emotion: ${edit.emotion.trim()}`);
  if (edit.style.trim()) modifiers.push(`style: ${edit.style.trim()}`);

  const angle = ANGLE_OPTIONS.find((o) => o.value === edit.angle);
  if (angle) modifiers.push(`angle: ${angle.modifier}`);

  const intensity = INTENSITY_LEVELS[edit.intensity];
  if (intensity?.modifier) modifiers.push(`intensity: ${intensity.modifier}`);

  if (modifiers.length === 0) return base;

  return `${base}\n\n— direction overrides —\n${modifiers.join('\n')}`;
}

export function describeEdit(edit: AdvancedEdit): string {
  const tags: string[] = [];
  if (edit.angle) {
    const a = ANGLE_OPTIONS.find((o) => o.value === edit.angle);
    if (a) tags.push(a.label);
  }
  const i = INTENSITY_LEVELS[edit.intensity];
  if (i && i.value !== 1) tags.push(i.label);
  if (edit.style.trim()) tags.push('estilo+');
  return tags.length ? tags.join(' · ') : 'sin overrides';
}

/**
 * Detecta si el edit cambió respecto al original de la escena.
 */
export function isEditDirty(
  edit: AdvancedEdit,
  base: AdvancedEdit
): boolean {
  return (
    edit.prompt !== base.prompt ||
    edit.camera !== base.camera ||
    edit.lighting !== base.lighting ||
    edit.emotion !== base.emotion ||
    edit.style !== base.style ||
    edit.angle !== base.angle ||
    edit.intensity !== base.intensity
  );
}

export function formatVersionTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function sceneFromVersion(
  scene: Scene,
  v: SceneVersion
): Scene {
  const { image_error, ...rest } = scene;
  void image_error;
  return {
    ...rest,
    scene_number: v.scene_number,
    image_prompt: v.image_prompt,
    camera: v.camera,
    lighting: v.lighting,
    emotion: v.emotion,
    image_url: v.image_url,
    ...(v.image_error ? { image_error: v.image_error } : {}),
  };
}
