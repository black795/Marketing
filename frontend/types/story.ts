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
}

export interface GenerateStoryResponse {
  success: boolean;
  projectId: string;
  model: string;
  scenes: Scene[];
}
