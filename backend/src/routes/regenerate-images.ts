import { Router, Request, Response } from 'express';
import { generateImage } from '../services/python-worker/imageWorker';
import { openSseStream } from '../services/sse';

interface RegenerateSceneInput {
  scene_number: number;
  image_prompt: string;
}

interface RegenerateRequestBody {
  model?: string;
  scenes?: RegenerateSceneInput[];
  quality?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}

const router = Router();

router.post('/regenerate-images', async (req: Request, res: Response) => {
  const { model, scenes, quality, aspectRatio, referenceImages } =
    req.body as RegenerateRequestBody;

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
      error: 'Each scene must include scene_number (number) and image_prompt (non-empty string)',
    });
  }

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream'));

  console.log(
    `[regenerate-images] start model=${model} count=${scenes.length} ` +
      `scenes=[${scenes.map((s) => s.scene_number).join(',')}] stream=${wantsStream}`
  );

  type ResultEntry = {
    scene_number: number;
    image_url: string | null;
    image_error?: string;
  };

  if (wantsStream) {
    const sse = openSseStream(res);
    const abort = new AbortController();
    let clientGone = false;

    req.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        console.log('[regenerate-images] client disconnected, aborting');
        abort.abort();
      }
    });

    sse.send({
      event: 'start',
      data: { model, total: scenes.length },
    });

    const results: ResultEntry[] = [];
    for (const scene of scenes) {
      if (abort.signal.aborted) break;

      sse.send({
        event: 'scene-start',
        data: {
          scene_number: scene.scene_number,
          index: results.length,
          total: scenes.length,
        },
      });

      const result = await generateImage({
        model,
        prompt: scene.image_prompt,
        quality,
        aspectRatio,
        referenceImageUrls: refs.length > 0 ? refs : undefined,
        abortSignal: abort.signal,
      });

      const entry: ResultEntry = {
        scene_number: scene.scene_number,
        image_url: result.image_url,
        ...(result.image_error ? { image_error: result.image_error } : {}),
      };
      results.push(entry);

      sse.send({
        event: 'scene-done',
        data: {
          result: entry,
          index: results.length,
          total: scenes.length,
          progress: results.length / scenes.length,
        },
      });
    }

    if (clientGone || abort.signal.aborted) {
      sse.send({
        event: 'cancelled',
        data: { completed: results.length, total: scenes.length, results },
      });
    } else {
      const failed = results.filter((r) => !r.image_url).length;
      console.log(
        `[regenerate-images] done total=${results.length} failed=${failed}`
      );
      sse.send({
        event: 'done',
        data: { success: true, model, results, failed },
      });
    }

    sse.close();
    return;
  }

  const results: ResultEntry[] = [];
  for (const scene of scenes) {
    console.log(`[regenerate-images] escena ${scene.scene_number} →`);
    const result = await generateImage({
      model,
      prompt: scene.image_prompt,
      quality,
      aspectRatio,
      referenceImageUrls: refs.length > 0 ? refs : undefined,
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
