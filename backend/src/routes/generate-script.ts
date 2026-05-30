import { Router, Request, Response } from 'express';
import { generateStoryFromPrompt } from '../services/claude/storyEngine';

interface GenerateScriptBody {
  visualPrompt?: string;
  narrativePrompt?: string;
  model?: string;
  /** Legacy: una sola imagen. Si se manda, se promueve a la lista. */
  referenceImage?: string;
  /** Lista canónica de referencias. */
  referenceImages?: string[];
  sceneCount?: number;
  /** Contexto de dominio (Perfil) ya formateado por el frontend. */
  profileContext?: string;
}

const router = Router();

router.post('/generate-script', async (req: Request, res: Response) => {
  const {
    visualPrompt,
    narrativePrompt,
    model,
    referenceImage,
    referenceImages,
    sceneCount,
    profileContext,
  } = req.body as GenerateScriptBody;

  const refs: string[] = Array.isArray(referenceImages)
    ? referenceImages.filter((s) => typeof s === 'string' && s.length > 0)
    : referenceImage
    ? [referenceImage]
    : [];

  if (!visualPrompt || typeof visualPrompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "visualPrompt" field',
    });
  }

  if (!model || typeof model !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "model" field',
    });
  }

  const normalizedSceneCount =
    typeof sceneCount === 'number' && sceneCount > 0 && sceneCount <= 20
      ? Math.round(sceneCount)
      : undefined;

  const projectId = `proj-${Date.now()}`;
  console.log(
    `[generate-script] start projectId=${projectId} model=${model} ` +
      `visualLen=${visualPrompt.length} narrativeLen=${narrativePrompt?.length ?? 0} ` +
      `sceneCount=${normalizedSceneCount ?? 'auto'} refs=${refs.length}`
  );

  try {
    const story = await generateStoryFromPrompt({
      visualPrompt,
      narrativePrompt,
      model,
      referenceImages: refs.length > 0 ? refs : undefined,
      sceneCount: normalizedSceneCount,
      profileContext:
        typeof profileContext === 'string' && profileContext.trim().length > 0
          ? profileContext
          : undefined,
    });
    console.log(
      `[generate-script] done projectId=${projectId} scenes=${story.scenes.length}`
    );

    return res.status(200).json({
      success: true,
      projectId,
      model,
      ...story,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-script] failed:', message);
    return res.status(500).json({
      success: false,
      error: message,
      projectId,
    });
  }
});

export default router;
