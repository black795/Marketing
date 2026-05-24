/**
 * Scene Graph — modelo de una escena editable.
 *
 * Reemplaza al `TimelineClip` plano del timeline legacy con un nodo rico:
 * assets, captions, overlays, audio, transiciones, efectos, cámara, emoción,
 * prompt creativo, render state y versiones. Cada escena es "auto-contenida"
 * y puede regenerarse, re-renderizarse o re-prompt-earse sin tocar el resto.
 *
 * NO sustituye al timeline.json — vive en paralelo. `editing/core/timeline-project`
 * hace la conversión bidireccional para mantener el pipeline de render actual.
 */

/** Rol narrativo dentro del Reel. Se detecta heurísticamente al armar el graph. */
export type SceneRole =
  | 'hook'
  | 'intro'
  | 'body'
  | 'cta'
  | 'outro'
  | 'transition';

/** Estado del render de la escena (no del proyecto entero). */
export type RenderState =
  | 'pending'
  | 'building'
  | 'ready'
  | 'failed'
  | 'stale';

/** Tono emocional dominante. Alimenta presets y prompts de regen. */
export type SceneEmotion =
  | 'neutral'
  | 'excited'
  | 'serious'
  | 'inspirational'
  | 'urgent'
  | 'calm'
  | 'playful';

/** Un asset asociado a una escena: imagen, video, audio o texto. */
export interface SceneAsset {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'text';
  /** URL o path local. null si aún no se generó. */
  src: string | null;
  /** Si fue generado por IA, queda la huella para regen reproducible. */
  generatedBy?: {
    provider: string;
    model: string;
    prompt: string;
    createdAt: string;
  };
  width?: number;
  height?: number;
  durationSec?: number;
  /** Metadata libre (peso, codec, hash, etc.). */
  metadata?: Record<string, unknown>;
}

/** Capa superpuesta sobre el video: texto, sticker, logo, forma. */
export interface SceneOverlay {
  id: string;
  kind: 'text' | 'sticker' | 'shape' | 'logo' | 'image';
  startFrame: number;
  endFrame: number;
  /** Posición relativa 0..1 dentro del frame. */
  position: { x: number; y: number; anchor?: 'tl' | 'tc' | 'tr' | 'cl' | 'center' | 'cr' | 'bl' | 'bc' | 'br' };
  /** Datos específicos del kind (texto, src del sticker, etc.). */
  content: Record<string, unknown>;
  /** Animación de entrada/salida. */
  animation?: { enter?: string; exit?: string };
}

/** Palabra con timing — para karaoke / word-by-word highlight. */
export interface SceneWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

/** Subtítulo asociado a la escena. */
export interface SceneCaption {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  /** id del estilo (tiktok, karaoke, viral-yellow, …). 'default' si no se definió. */
  style: string;
  words: SceneWord[];
}

/** Pista de audio asociada a la escena (voz, música, SFX). */
export interface SceneAudioTrack {
  id: string;
  kind: 'voiceover' | 'music' | 'sfx';
  src: string;
  startFrame: number;
  durationFrames: number;
  /** 0..1. */
  volume: number;
  /** Loop hasta el final de la escena. */
  loop?: boolean;
  /** Fade de entrada/salida en frames. */
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

/** Transición entre escenas. */
export interface SceneTransition {
  /** 'cut' | 'fade' | 'slide-left' | 'slide-up' | 'whip' | 'zoom-in' | … */
  inKind: string;
  outKind: string;
  inDurationFrames: number;
  outDurationFrames: number;
}

/** Efecto aplicado al clip principal de la escena (zoom, shake, glitch). */
export interface SceneEffect {
  id: string;
  kind: string;
  /** Parámetros del efecto (intensity, easing, …). */
  params: Record<string, unknown>;
  startFrame?: number;
  endFrame?: number;
}

/** Movimientos de cámara virtual (Ken Burns, push-in, pan). */
export interface SceneCamera {
  preset?: string;
  pan?: { fromX: number; toX: number; fromY: number; toY: number };
  zoom?: { from: number; to: number };
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/** Snapshot inmutable de una escena — base del historial editable. */
export interface SceneVersion {
  id: string;
  createdAt: string;
  /** Etiqueta del usuario o auto-generada ("regen v3", "antes del CTA…"). */
  label?: string;
  /** Razón de creación: regen, manual-edit, prompt-change, import, … */
  reason: string;
  /** Snapshot completo de la escena en ese momento (sin recursión de versions). */
  snapshot: Omit<Scene, 'versions'>;
}

/** El nodo principal — una escena editable del Reel. */
export interface Scene {
  /** id único del scene graph. */
  id: string;
  /** Número original 1..N. Sobrevive a reordenamientos. */
  sceneNumber: number;
  name: string;
  role: SceneRole;
  /** Frame absoluto dentro del proyecto. Recalculado al reordenar. */
  startFrame: number;
  endFrame: number;
  durationFrames: number;

  assets: SceneAsset[];
  overlays: SceneOverlay[];
  captions: SceneCaption[];
  audioTracks: SceneAudioTrack[];

  transition: SceneTransition;
  effects: SceneEffect[];
  camera: SceneCamera | null;

  emotion: SceneEmotion;
  /** Prompt creativo libre — feed del regen IA. */
  prompt: string;
  /** Preset de estilo aplicado a esta escena (override del global). null = hereda. */
  stylePresetId: string | null;
  renderState: RenderState;
  versions: SceneVersion[];
  /** Si está incluida en el render final. */
  included: boolean;
  /** Notas del autor (no afectan al render). */
  notes?: string;
}
