export interface GenerateStoryRequest {
  prompt: string;
  storyGuide?: string;
  model: string;
  referenceImage?: string;
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

export interface GeneratedStory {
  title: string;
  style: string;
  characters: Character[];
  scenes: Scene[];
}

export interface GenerateStoryResponse extends GeneratedStory {
  success: true;
  projectId: string;
  model: string;
}

export interface GenerateStoryErrorResponse {
  success: false;
  error: string;
}
