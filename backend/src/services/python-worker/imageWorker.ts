const WORKER_URL =
  process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

const REQUEST_TIMEOUT_MS = 90_000;

export interface GenerateImageInput {
  model: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio?: string;
}

export interface GenerateImageResult {
  image_url: string | null;
  image_error?: string;
}

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${WORKER_URL}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        reference_image_url: input.referenceImageUrl,
        aspect_ratio: input.aspectRatio ?? '9:16',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Worker responded ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // ignore parse failures, use the default status message
      }
      return { image_url: null, image_error: detail };
    }

    const data = (await response.json()) as { image_url?: string };
    if (!data.image_url) {
      return { image_url: null, image_error: 'Worker returned no image_url' };
    }
    return { image_url: data.image_url };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        image_url: null,
        image_error: `Timeout after ${REQUEST_TIMEOUT_MS / 1000}s`,
      };
    }
    const message = err instanceof Error ? err.message : 'Unknown worker error';
    return { image_url: null, image_error: message };
  } finally {
    clearTimeout(timer);
  }
}
