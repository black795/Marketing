import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import {
  buildTimeline,
  saveTimeline,
  loadTimeline,
  type BuildTimelineInput,
  type TimelineSceneInput,
  type TimelineCaption,
} from '../services/timeline';

/**
 * Rutas del timeline compartido.
 *
 *   POST /api/timeline/build   — construye timeline.json desde escenas y lo guarda
 *   GET  /api/timeline/:id     — carga el timeline.json persistido
 *
 * El mismo documento alimenta tanto al renderer de Remotion como al de
 * Captions: una sola fuente de verdad, sin duplicar escenas ni captions.
 */

const router = Router();
const log = createLogger('timeline-api');

// POST /api/timeline/build
router.post('/timeline/build', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = req.body as Partial<BuildTimelineInput>;

  const projectId =
    typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : '';
  if (!projectId) {
    return res.status(400).json({
      success: false,
      error: 'Falta "projectId"',
      requestId,
    });
  }
  if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Falta el array "scenes" o está vacío',
      requestId,
    });
  }

  const scenes: TimelineSceneInput[] = body.scenes
    .filter((s) => s && typeof s.scene_number === 'number')
    .map((s) => ({
      scene_number: s.scene_number,
      image_url: s.image_url ?? null,
      video_url: s.video_url ?? null,
      local_url: s.local_url ?? null,
      duration: typeof s.duration === 'number' ? s.duration : undefined,
      narration: typeof s.narration === 'string' ? s.narration : undefined,
    }));

  if (scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Ninguna escena válida (cada una requiere scene_number numérico)',
      requestId,
    });
  }

  const doc = buildTimeline({
    projectId,
    title: body.title,
    fps: body.fps,
    width: body.width,
    height: body.height,
    source: body.source,
    audioUrl: body.audioUrl ?? null,
    respectOrder: body.respectOrder === true,
    scenes,
  });

  let savedPath: string;
  try {
    savedPath = saveTimeline(doc);
  } catch (err) {
    log.error('no se pudo guardar el timeline', { requestId, projectId }, err);
    return res.status(500).json({
      success: false,
      error: 'No se pudo persistir el timeline',
      requestId,
    });
  }

  log.info(
    `timeline construido projectId=${projectId} clips=${doc.clips.length} ` +
      `captions=${doc.captions.length}`,
    { requestId }
  );
  res.status(200).json({ success: true, requestId, timeline: doc, path: savedPath });
});

// GET /api/timeline/:projectId
router.get('/timeline/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const doc = loadTimeline(projectId);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: `No hay timeline para el proyecto "${projectId}"`,
    });
  }
  res.status(200).json({ success: true, timeline: doc });
});

/**
 * PUT /api/timeline/:projectId/captions
 *
 * Reemplaza el array `captions` del timeline existente sin tocar clips/audio.
 * Body: { captions: [{ id?, text, startSeconds, durationSeconds, style? }] }
 * El backend convierte segundos a frames usando el fps actual del timeline.
 */
router.put('/timeline/:projectId/captions', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { projectId } = req.params;
  const body = (req.body || {}) as {
    captions?: Array<{
      id?: string;
      text?: string;
      startSeconds?: number;
      durationSeconds?: number;
      style?: string;
    }>;
  };

  const doc = loadTimeline(projectId);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: `No hay timeline para el proyecto "${projectId}"`,
      requestId,
    });
  }

  if (!Array.isArray(body.captions)) {
    return res.status(400).json({
      success: false,
      error: 'Falta el array "captions"',
      requestId,
    });
  }

  const captions: TimelineCaption[] = [];
  for (const [idx, c] of body.captions.entries()) {
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    if (!text) continue;
    const start = Math.max(0, Number(c.startSeconds ?? 0));
    const dur = Math.max(0.1, Number(c.durationSeconds ?? 1));
    const startFrame = Math.round(start * doc.fps);
    const endFrame = Math.round((start + dur) * doc.fps);
    if (endFrame <= startFrame) continue;
    captions.push({
      id: c.id || `caption-user-${idx + 1}`,
      text,
      startFrame,
      endFrame,
      words: [], // sin timing por palabra — Karaoke avanzado queda fuera de scope
      style: typeof c.style === 'string' && c.style ? c.style : 'default',
    });
  }

  const next = { ...doc, captions };
  try {
    saveTimeline(next);
  } catch (err) {
    log.error('no se pudo guardar el timeline', { requestId, projectId }, err);
    return res.status(500).json({
      success: false,
      error: 'No se pudo persistir el timeline',
      requestId,
    });
  }

  log.info(
    `captions actualizadas projectId=${projectId} count=${captions.length}`,
    { requestId }
  );
  res.status(200).json({ success: true, timeline: next });
});

export default router;
