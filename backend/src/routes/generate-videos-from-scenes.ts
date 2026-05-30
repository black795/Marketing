import { Router, Request, Response } from 'express';
import {
  checkWorkerHealth,
} from '../services/python-worker/imageWorker';
import { generateVideo } from '../services/python-worker/videoWorker';
import { openSseStream } from '../services/sse';
import { persistVideo } from '../services/video-persistence';

interface VideoSceneInput {
  scene_number: number;
  image_url?: string | null;
  video_prompt: string;
  /** Duración por escena en segundos (snappeada por el FE a 3/5/10). */
  duration?: number;
}

interface VideoSceneOutput extends VideoSceneInput {
  video_url: string | null;
  /** URL persistente bajo /assets/output/... (sirve incluso cuando expira la de Replicate). */
  local_url?: string | null;
  video_error?: string;
}

interface GenerateVideosBody {
  model?: string;
  projectId?: string;
  duration?: number;
  resolution?: string;
  sound?: boolean;
  aspectRatio?: string;
  scenes?: VideoSceneInput[];
  referenceImageUrls?: string[];
}

const ALLOWED_MODELS = new Set(['kling-v3-omni', 'kling-v3']);

const router = Router();

router.post('/generate-videos-from-scenes', async (req: Request, res: Response) => {
  const {
    model,
    projectId,
    duration,
    resolution,
    sound,
    aspectRatio,
    scenes,
    referenceImageUrls,
  } = req.body as GenerateVideosBody;

  if (!model || typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({
      success: false,
      error: `Missing or invalid "model". Allowed: ${[...ALLOWED_MODELS].join(', ')}`,
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
      typeof s.video_prompt !== 'string' ||
      s.video_prompt.trim().length === 0
  );
  if (invalid) {
    return res.status(400).json({
      success: false,
      error: 'Each scene must include scene_number and a non-empty video_prompt',
    });
  }

  const refs: string[] = Array.isArray(referenceImageUrls)
    ? referenceImageUrls.filter((s) => typeof s === 'string' && s.length > 0)
    : [];

  if (refs.length > 0 && model !== 'kling-v3-omni') {
    return res.status(400).json({
      success: false,
      error: `referenceImageUrls only supported by kling-v3-omni (got ${model})`,
    });
  }

  const dur = typeof duration === 'number' ? duration : 5;
  const res_ = typeof resolution === 'string' ? resolution : '1080p';
  const snd = typeof sound === 'boolean' ? sound : true;
  const aspect = typeof aspectRatio === 'string' ? aspectRatio : '9:16';

  const wantsStream =
    req.query.stream === '1' ||
    (typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream'));

  console.log(
    `[generate-videos-from-scenes] start projectId=${projectId ?? 'n/a'} ` +
      `model=${model} scenes=${scenes.length} dur=${dur}s res=${res_} sound=${snd} ` +
      `aspect=${aspect} refs=${refs.length} stream=${wantsStream}`
  );

  const health = await checkWorkerHealth();
  if (!health.ok) {
    console.warn(
      `[generate-videos-from-scenes] worker health failed: ${health.detail}`
    );
  }

  // ------------------------------------------------------------------
  // Modo SSE — serie estricta (Kling es lento y caro, sin paralelismo).
  // ------------------------------------------------------------------
  if (wantsStream) {
    const abort = new AbortController();

    // FIX: la desconexión se detecta vía res.on('close') dentro de
    // openSseStream — NO con req.on('close'), que saltaba al terminar de
    // recibir el body del POST y abortaba la generación por error.
    // Ver el comentario extenso en services/sse.ts.
    const sse = openSseStream(res, {
      label: 'generate-videos-from-scenes',
      onClientDisconnect: () => {
        console.log(
          '[generate-videos-from-scenes] cliente desconectado realmente, abortando'
        );
        abort.abort();
      },
    });

    sse.send({
      event: 'start',
      data: {
        projectId: projectId ?? null,
        model,
        total: scenes.length,
        duration: dur,
        resolution: res_,
        sound: snd,
        aspectRatio: aspect,
      },
    });

    if (!health.ok) {
      sse.send({
        event: 'warning',
        data: { message: `Worker health check failed: ${health.detail}` },
      });
    }

    const out: VideoSceneOutput[] = [];
    for (const scene of scenes) {
      if (abort.signal.aborted) break;

      sse.send({
        event: 'scene-start',
        data: {
          scene_number: scene.scene_number,
          index: out.length,
          total: scenes.length,
        },
      });

      const sceneDur =
        typeof scene.duration === 'number' && scene.duration > 0
          ? scene.duration
          : dur;
      const result = await generateVideo({
        model,
        prompt: scene.video_prompt,
        imageUrl: scene.image_url ?? undefined,
        referenceImageUrls: refs.length > 0 ? refs : undefined,
        aspectRatio: aspect,
        duration: sceneDur,
        resolution: res_,
        sound: snd,
        abortSignal: abort.signal,
      });

      let localUrl: string | null = null;
      if (result.video_url) {
        try {
          const persisted = await persistVideo({
            videoUrl: result.video_url,
            projectId: projectId ?? null,
            sceneNumber: scene.scene_number,
          });
          localUrl = persisted.url;
          console.log(
            `[generate-videos-from-scenes] persisted scene ${scene.scene_number} → ${persisted.staticPath}`
          );
        } catch (err) {
          console.warn(
            `[generate-videos-from-scenes] persist failed for scene ${scene.scene_number}:`,
            err instanceof Error ? err.message : err
          );
          sse.send({
            event: 'warning',
            data: {
              message: `No se pudo persistir la escena ${scene.scene_number}. URL temporal de Replicate disponible.`,
            },
          });
        }
      }

      const merged: VideoSceneOutput = {
        ...scene,
        video_url: result.video_url,
        ...(localUrl ? { local_url: localUrl } : {}),
        ...(result.video_error ? { video_error: result.video_error } : {}),
      };
      out.push(merged);

      const eventName = result.video_url ? 'scene-done' : 'scene-error';
      sse.send({
        event: eventName,
        data: {
          scene: merged,
          index: out.length,
          total: scenes.length,
          progress: out.length / scenes.length,
        },
      });
    }

    if (sse.isClientGone() || abort.signal.aborted) {
      sse.send({
        event: 'cancelled',
        data: { completed: out.length, total: scenes.length, scenes: out },
      });
    } else {
      const failed = out.filter((s) => !s.video_url).length;
      console.log(
        `[generate-videos-from-scenes] done total=${out.length} failed=${failed}`
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
  // Modo JSON (sin streaming). Igual procesa en serie.
  // ------------------------------------------------------------------
  const out: VideoSceneOutput[] = [];
  for (const scene of scenes) {
    const sceneDur =
      typeof scene.duration === 'number' && scene.duration > 0
        ? scene.duration
        : dur;
    console.log(
      `[generate-videos-from-scenes] escena ${scene.scene_number}/${scenes.length} (dur=${sceneDur}s) →`
    );
    const result = await generateVideo({
      model,
      prompt: scene.video_prompt,
      imageUrl: scene.image_url ?? undefined,
      referenceImageUrls: refs.length > 0 ? refs : undefined,
      aspectRatio: aspect,
      duration: sceneDur,
      resolution: res_,
      sound: snd,
    });

    let localUrl: string | null = null;
    if (result.video_url) {
      try {
        const persisted = await persistVideo({
          videoUrl: result.video_url,
          projectId: projectId ?? null,
          sceneNumber: scene.scene_number,
        });
        localUrl = persisted.url;
      } catch (err) {
        console.warn(
          `[generate-videos-from-scenes] persist failed for scene ${scene.scene_number}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    out.push({
      ...scene,
      video_url: result.video_url,
      ...(localUrl ? { local_url: localUrl } : {}),
      ...(result.video_error ? { video_error: result.video_error } : {}),
    });
  }

  const failed = out.filter((s) => !s.video_url).length;
  console.log(
    `[generate-videos-from-scenes] done total=${out.length} failed=${failed}`
  );

  return res.status(200).json({
    success: true,
    model,
    projectId: projectId ?? null,
    scenes: out,
  });
});

export default router;
