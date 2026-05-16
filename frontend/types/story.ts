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
