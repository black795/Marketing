import { Router, Request, Response } from 'express';
import type { Scene } from '../types/story';
import {
  checkWorkerHealth,
  generateImage,
} from '../services/python-worker/imageWorker';

interface ScriptSceneInput {
  scene_number: number;
  scene_title: string;
  narration: string;
  camera: string;
  lighting: string;
  emotion: string;
  image_prompt: string;
  duration: number;
}

interface GenerateImagesBody {
  model?: string;
  projectId?: string;
  scenes?: ScriptSceneInput[];
  quality?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}

const router = Router();

router.post('/generate-images-from-script', async (req: Request, res: Response) => {
  const { model, projectId, scenes, quality, aspectRatio, referenceImages } =
    req.body as GenerateImagesBody;

  const refs: string[] = Array.isArray(referenceImages)
    ? referenceImages.filter((s) => typeof s === 'string' && s.length > 0)
    : [];

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
      error: 'Each scene must include scene_number and a non-empty image_prompt',
    });
  }

  console.log(
    `[generate-images-from-script] start projectId=${projectId ?? 'n/a'} ` +
      `model=${model} scenes=${scenes.length} quality=${quality ?? 'standard'} ` +
      `aspect=${aspectRatio ?? '9:16'} refs=${refs.length}`
  );

  const health = await checkWorkerHealth();
  if (!health.ok) {
    console.warn(
      `[generate-images-from-script] worker health failed: ${health.detail}`
    );
  }

  const out: Scene[] = [];
  for (const scene of scenes) {
    console.log(
      `[generate-images-from-script] escena ${scene.scene_number}/${scenes.length} →`
    );
    const result = await generateImage({
      model,
      prompt: scene.image_prompt,
      quality,
      aspectRatio,
      referenceImageUrls: refs.length > 0 ? refs : undefined,
    });
    out.push({
      ...scene,
      image_url: result.image_url,
      ...(result.image_error ? { image_error: result.image_error } : {}),
    });
  }

  const failed = out.filter((s) => !s.image_url).length;
  console.log(
    `[generate-images-from-script] done total=${out.length} failed=${failed}`
  );

  return res.status(200).json({
    success: true,
    model,
    projectId: projectId ?? null,
    scenes: out,
  });
});

export default router;
