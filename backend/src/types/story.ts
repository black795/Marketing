export interface GenerateStoryRequest {
  prompt: string;
  storyGuide?: string;
  model: string;
  referenceImage?: string;
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
