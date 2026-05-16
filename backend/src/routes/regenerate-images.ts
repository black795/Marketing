7import { Router, Request, Response } from 'express';
import { generateImage } from '../services/python-worker/imageWorker';

interface RegenerateSceneInput {
  scene_number: number;
  image_prompt: string;
}

interface RegenerateRequestBody {
  model?: string;
  scenes?: RegenerateSceneInput[];
}

const router = Router();

router.post('/regenerate-images', async (req: Request, res: Response) => {
  const { model, scenes } = req.body as RegenerateRequestBody;

  if (!model || typeof model !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "model" field',
    });
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing or empty "scenes" array',
    });
  }

  const invalid = scenes.find(
    (s) =>
      typeof s.scene_number !== 'number' ||
      typeof s.image_prompt !== 'string' ||
      s.image_prompt.trim().length === 0
  );
  if (invalid) {
    return res.status(400).json({
      success: false,
      error: 'Each scene must include scene_number (number) and image_prompt (non-empty string)',
    });
  }

  console.log(
    `[regenerate-images] start model=${model} count=${scenes.length} ` +
    `scenes=[${scenes.map((s) => s.scene_number).join(',')}]`
  );

  const results: Array<{
    scene_number: number;
    image_url: string | null;
    image_error?: string;
  }> = [];

  for (const scene of scenes) {
    console.log(
      `[regenerate-images] escena ${scene.scene_number} →`
    );
    const result = await generateImage({
      model,
      prompt: scene.image_prompt,
    });
    results.push({
      scene_number: scene.scene_number,
      image_url: result.image_url,
      ...(result.image_error ? { image_error: result.image_error } : {}),
    });
  }

  const failed = results.filter((r) => !r.image_url).length;
  console.log(
    `[regenerate-images] done total=${results.length} failed=${failed}`
  );

  return res.status(200).json({
    success: true,
    model,
    results,
  });
});

export default router;
