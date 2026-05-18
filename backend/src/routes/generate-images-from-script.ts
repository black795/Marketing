import { Router, Request, Response } from 'express';
import type { Scene } from '../types/story';
import {
  checkWorkerHealth,
  generateImage,
} from '../services/python-worker/imageWorker';
import { openSseStream } from '../services/sse';

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

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream'));

  console.log(
    `[generate-images-from-script] start projectId=${projectId ?? 'n/a'} ` +
      `model=${model} scenes=${scenes.length} quality=${quality ?? 'standard'} ` +
      `aspect=${aspectRatio ?? '9:16'} refs=${refs.length} stream=${wantsStream}`
  );

  const health = await checkWorkerHealth();
  if (!health.ok) {
    console.warn(
      `[generate-images-from-script] worker health failed: ${health.detail}`
    );
  }

  // ------------------------------------------------------------------
  // Modo SSE — el frontend recibe eventos progress/scene/done en vivo.
  // ------------------------------------------------------------------
  if (wantsStream) {
    const sse = openSseStream(res);
    const abort = new AbortController();
    let clientGone = false;

    req.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        console.log('[generate-images-from-script] client disconnected, aborting');
        abort.abort();
      }
    });

    sse.send({
      event: 'start',
      data: {
        projectId: projectId ?? null,
        model,
        total: scenes.length,
        quality: quality ?? 'standard',
        aspectRatio: aspectRatio ?? '9:16',
      },
    });

    if (!health.ok) {
      sse.send({
        event: 'warning',
        data: { message: `Worker health check failed: ${health.detail}` },
      });
    }

    const out: Scene[] = [];
    for (const scene of scenes) {
      if (abort.signal.aborted) break;

      sse.send({
        event: 'scene-start',
        data: {
          scene_number: scene.scene_number,
          scene_title: scene.scene_title,
          index: out.length,
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

      const merged: Scene = {
        ...scene,
        image_url: result.image_url,
        ...(result.image_error ? { image_error: result.image_error } : {}),
      };
      out.push(merged);

      sse.send({
        event: 'scene-done',
        data: {
          scene: merged,
          index: out.length,
          total: scenes.length,
          progress: out.length / scenes.length,
        },
      });
    }

    if (clientGone || abort.signal.aborted) {
      sse.send({
        event: 'cancelled',
        data: { completed: out.length, total: scenes.length, scenes: out },
      });
    } else {
      const failed = out.filter((s) => !s.image_url).length;
      console.log(
        `[generate-images-from-script] done total=${out.length} failed=${failed}`
      );
      sse.send({
        event: 'done',
        data: {
          success: true,
          model,
          projectId: projectId ?? null,
          scenes: out,
          failed,
        },
      });
    }

    sse.close();
    return;
  }

  // ------------------------------------------------------------------
  // Modo legacy JSON (compat). Sin streaming ni cancelación temprana.
  // ------------------------------------------------------------------
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
