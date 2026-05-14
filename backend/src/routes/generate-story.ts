import { Router, Request, Response } from 'express';
import type {
  GenerateStoryRequest,
  GenerateStoryResponse,
} from '../types/story';

const router = Router();

router.post('/generate-story', (req: Request, res: Response) => {
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

  void storyGuide;
  void referenceImage;

  const response: GenerateStoryResponse = {
    success: true,
    projectId: `test-${Date.now()}`,
    model,
    scenes: [],
  };

  return res.status(200).json(response);
});

export default router;
