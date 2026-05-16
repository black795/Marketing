import { Router, Request, Response } from 'express';
import type { GenerateStoryRequest, Scene } from '../types/story';
import { generateStoryFromPrompt } from '../services/claude/storyEngine';
import {
  checkWorkerHealth,
  generateImage,
} from '../services/python-worker/imageWorker';

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
  console.log(
    `[generate-story] start projectId=${projectId} model=${model} promptLen=${prompt.length}`
  );

  try {
    const health = await checkWorkerHealth();
    if (!health.ok) {
      console.warn(
        `[generate-story] worker health check failed: ${health.detail}. ` +
          `Continuaré igual y cada escena reportará su propio error.`
      );
    } else {
      console.log('[generate-story] worker health OK');
    }

    const story = await generateStoryFromPrompt({
      visualPrompt: prompt,
      narrativePrompt: storyGuide,
      model,
      referenceImages: referenceImage ? [referenceImage] : undefined,
    });
    console.log(
      `[generate-story] Claude returned ${story.scenes.length} scenes — generando imágenes…`
    );

    // Procesamiento SECUENCIAL: Replicate aplica burst=1 a cuentas con
    // crédito bajo, así que paralelizar dispara 429 en cascada.
    // Una imagen a la vez + retry en imageWorker.ts cubren ambos casos.
    const scenesWithImages: Scene[] = [];
    for (const scene of story.scenes) {
      console.log(
        `[generate-story] escena ${scene.scene_number}/${story.scenes.length} →`
      );
      const result = await generateImage({
        model,
        prompt: scene.image_prompt,
      });
      scenesWithImages.push({
        ...scene,
        image_url: result.image_url,
        ...(result.image_error ? { image_error: result.image_error } : {}),
      });
    }

    const failed = scenesWithImages.filter((s) => !s.image_url).length;
    console.log(
      `[generate-story] done projectId=${projectId} scenes=${scenesWithImages.length} failed=${failed}`
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
