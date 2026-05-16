import type {
  GenerateStoryRequest,
  GenerateStoryResponse,
  GenerateScriptRequest,
  GenerateScriptResponse,
  GenerateImagesFromScriptRequest,
  GenerateImagesFromScriptResponse,
  RegenerateImagesRequest,
  RegenerateImagesResponse,
} from '@/types/story';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function generateStory(
  payload: GenerateStoryRequest
): Promise<GenerateStoryResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateStoryResponse;
}

export async function generateScript(
  payload: GenerateScriptRequest
): Promise<GenerateScriptResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateScriptResponse;
}

export async function generateImagesFromScript(
  payload: GenerateImagesFromScriptRequest
): Promise<GenerateImagesFromScriptResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-images-from-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateImagesFromScriptResponse;
}

export async function regenerateImages(
  payload: RegenerateImagesRequest
): Promise<RegenerateImagesResponse> {
  const response = await fetch(`${BACKEND_URL}/api/regenerate-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as RegenerateImagesResponse;
}
