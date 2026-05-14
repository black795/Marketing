import { Router, Request, Response } from 'express';
import type { GenerateStoryRequest } from '../types/story';
import { generateStoryFromPrompt } from '../services/claude/storyEngine';

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

    return res.status(200).json({
      success: true,
      projectId,
      model,
      ...story,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-story] Claude call failed:', message);
    return res.status(500).json({
      success: false,
      error: message,
      projectId,
    });
  }
});

export default router;
