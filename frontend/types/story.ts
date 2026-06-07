export interface GenerateStoryRequest {
  prompt: string;
  storyGuide?: string;
  model: string;
  referenceImage?: string;
}

export interface GenerateScriptRequest {
  visualPrompt: string;
  narrativePrompt?: string;
  model: string;
  /** Lista canónica de referencias del personaje. */
  referenceImages?: string[];
  /** Legacy: una sola ref. Aún aceptada por backend pero el FE manda plural. */
  referenceImage?: string;
  sceneCount?: number;
  /** Contexto de dominio (Perfil) ya formateado. Sesga el guion al rubro. */
  profileContext?: string;
  /** Dirección de arte / estética ya formateada (preset o estilo guardado). */
  styleContext?: string;
}

export interface GenerateScriptResponse {
  success: boolean;
  projectId: string;
  model: string;
  title?: string;
  style?: string;
  characters?: Character[];
  scenes: Scene[];
}

export interface GenerateImagesFromScriptRequest {
  model: string;
  projectId?: string;
  scenes: Scene[];
  quality?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}

export interface GenerateImagesFromScriptResponse {
  success: boolean;
  model: string;
  projectId: string | null;
  scenes: Scene[];
}

/** Bloque narrativo del skill /script (5 bloques). */
export type ScriptBlock = 'hook' | 'pre-cta' | 'walkthrough' | 'transition' | 'cta';

/** Tipo de shot del skill /storyboard (shot deck). */
export type ShotType = 'AI' | 'SCREEN_REC' | 'TEXT' | 'VIDEO';

export interface Scene {
  scene_number: number;
  scene_title: string;
  narration: string;
  camera: string;
  lighting: string;
  emotion: string;
  image_prompt: string;
  duration: number;
  image_url?: string | null;
  image_error?: string;
  imported_video_url?: string | null;
  /** A qué bloque del guion sirve esta escena (HOOK/PRE-CTA/...). */
  block?: ScriptBlock;
  /** Tipo de shot del storyboard. AI por default si no se especifica. */
  shot_type?: ShotType;
  /** Caption sugerido para esta escena (3-5 palabras, en idioma del usuario). */
  text_overlay?: string;
}

export interface Character {
  name: string;
  description: string;
}

export interface GenerateStoryResponse {
  success: boolean;
  projectId: string;
  model: string;
  title?: string;
  style?: string;
  characters?: Character[];
  scenes: Scene[];
}

export interface RegenerateImagesRequest {
  model: string;
  scenes: Array<{
    scene_number: number;
    image_prompt: string;
  }>;
  quality?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}

export interface RegenerateImageResult {
  scene_number: number;
  image_url: string | null;
  image_error?: string;
}

export interface RegenerateImagesResponse {
  success: boolean;
  model: string;
  results: RegenerateImageResult[];
}

// ============================================================
// Video (Kling v3 family)
// ============================================================

export type VideoModel = 'kling-v3-omni' | 'kling-v3';

export interface VideoSceneInput {
  scene_number: number;
  image_url: string;
  video_prompt: string;
  /** Duración por escena snappeada a la grilla de Kling (3/5/10s). */
  duration?: number;
}

export interface VideoSceneOutput {
  scene_number: number;
  image_url?: string | null;
  video_prompt: string;
  video_url: string | null;
  /** URL persistente servida por el backend (sobrevive a la expiración de Replicate). */
  local_url?: string | null;
  video_error?: string;
}

export interface GenerateVideosFromScenesRequest {
  model: VideoModel;
  projectId?: string;
  duration: number;
  resolution: '720p' | '1080p';
  sound: boolean;
  aspectRatio?: string;
  scenes: VideoSceneInput[];
  referenceImageUrls?: string[];
}
