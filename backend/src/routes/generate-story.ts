import { Router, Request, Response } from 'express';
import type { GenerateStoryRequest, Scene } from '../types/story';
import { generateStoryFromPrompt } from '../services/claude/storyEngine';
import { generateImage } from '../services/python-worker/imageWorker';

const router = Router();

router.post('/generate-story', async (req: Request, res: Response) => {
  const { prompt, storyGuide, model, referenceImage } =
    req.body as Partial<GenerateStoryRequest>;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "prompt" field',
    });
  }

  if (!model || typeof model !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "model" field',
    });
  }

  const projectId = `proj-${Date.now()}`;

  try {
    const story = await generateStoryFromPrompt({
      prompt,
      storyGuide,
      model,
      referenceImage,
    });

    const scenesWithImages: Scene[] = await Promise.all(
      story.scenes.map(async (scene) => {
        const result = await generateImage({
          model,
          prompt: scene.image_prompt,
        });
        return {
          ...scene,
          image_url: result.image_url,
          ...(result.image_error ? { image_error: result.image_error } : {}),
        };
      })
    );

    return res.status(200).json({
      success: true,
      projectId,
      model,
      ...story,
      scenes: scenesWithImages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-story] failed:', message);
    return res.status(500).json({
      success: false,
      error: message,
      projectId,
    });
  }
});

export default router;
