import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../services/logger';
import {
  loadRegistry,
  upsertBrand,
  deleteBrand,
  getAvatar,
  upsertAvatar,
  deleteAvatar,
  recordGeneration,
  persistReferenceImage,
  type AvatarIdentity,
} from '../services/avatar-registry';

/**
 * API del Registro de Avatares (memoria de personajes por marca).
 *
 *   GET    /api/avatar-registry                      — marcas + avatares
 *   POST   /api/avatar-registry/brands               — crear/editar marca
 *   DELETE /api/avatar-registry/brands/:brandId      — borrar marca (y sus avatares)
 *   GET    /api/avatar-registry/avatars/:avatarId    — un avatar
 *   POST   /api/avatar-registry/avatars              — crear/editar avatar
 *   DELETE /api/avatar-registry/avatars/:avatarId    — borrar avatar
 *   POST   /api/avatar-registry/avatars/:avatarId/used — marcar usado (telemetría)
 *
 * Al guardar un avatar, las imágenes que vengan como data: URL se persisten a
 * disco y en el JSON quedan solo sus rutas estáticas (igual que el resto de
 * assets del proyecto).
 */
const router = Router();
const log = createLogger('avatar-registry-api');

router.get('/avatar-registry', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, registry: loadRegistry() });
});

// --- Marcas -----------------------------------------------------------------

router.post('/avatar-registry/brands', (req: Request, res: Response) => {
  const { id, name } = (req.body || {}) as { id?: string; name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'La marca necesita un nombre.' });
  }
  try {
    res.status(200).json({ success: true, brand: upsertBrand({ id, name: name.trim() }) });
  } catch (err) {
    log.error('no se pudo guardar marca', undefined, err);
    res.status(500).json({ success: false, error: 'No se pudo guardar la marca.' });
  }
});

router.delete('/avatar-registry/brands/:brandId', (req: Request, res: Response) => {
  const result = deleteBrand(req.params.brandId);
  res.status(200).json({ success: true, ...result });
});

// --- Avatares ---------------------------------------------------------------

router.get('/avatar-registry/avatars/:avatarId', (req: Request, res: Response) => {
  const avatar = getAvatar(req.params.avatarId);
  if (!avatar) {
    return res.status(404).json({ success: false, error: 'Avatar no encontrado.' });
  }
  res.status(200).json({ success: true, avatar });
});

router.post('/avatar-registry/avatars', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as {
    id?: string;
    brandId?: string;
    name?: string;
    identity?: Partial<AvatarIdentity>;
  };

  if (!body.brandId) {
    return res.status(400).json({ success: false, error: 'Falta brandId.' });
  }
  if (!body.name || !body.name.trim()) {
    return res.status(400).json({ success: false, error: 'El avatar necesita un nombre.' });
  }
  const inId = body.identity ?? {};
  if (!inId.primaryImageUrl) {
    return res
      .status(400)
      .json({ success: false, error: 'El avatar necesita una imagen principal.' });
  }

  // id estable ANTES de persistir imágenes (se usa como carpeta de refs).
  const avatarId = body.id ?? randomUUID();

  try {
    const primaryImageUrl = await persistReferenceImage(inId.primaryImageUrl, avatarId, 0);
    const refsIn = Array.isArray(inId.referenceImages) ? inId.referenceImages : [];
    const referenceImages: string[] = [];
    for (let i = 0; i < refsIn.length; i++) {
      referenceImages.push(await persistReferenceImage(refsIn[i], avatarId, i + 1));
    }

    const identity: AvatarIdentity = {
      primaryImageUrl,
      referenceImages,
      loraModelId: inId.loraModelId ?? null,
      voice: inId.voice ?? 'Zephyr (Female)',
      voiceLanguage: inId.voiceLanguage ?? 'English (US)',
      voicePrompt: inId.voicePrompt ?? 'Say the following.',
      videoPrompt:
        inId.videoPrompt ??
        'The person is talking, subtle natural head movement, natural blinking, slight body sway, breathing.',
      resolution: inId.resolution ?? '720p',
      seed: inId.seed ?? null,
      modelId: inId.modelId ?? null,
      personaNotes: inId.personaNotes ?? '',
    };

    const avatar = upsertAvatar({ id: avatarId, brandId: body.brandId, name: body.name.trim(), identity });
    res.status(200).json({ success: true, avatar });
  } catch (err) {
    log.error('no se pudo guardar avatar', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo guardar el avatar: ${msg}` });
  }
});

router.delete('/avatar-registry/avatars/:avatarId', (req: Request, res: Response) => {
  const ok = deleteAvatar(req.params.avatarId);
  if (!ok) return res.status(404).json({ success: false, error: 'Avatar no encontrado.' });
  res.status(200).json({ success: true });
});

router.post('/avatar-registry/avatars/:avatarId/used', (req: Request, res: Response) => {
  const avatar = recordGeneration(req.params.avatarId);
  if (!avatar) return res.status(404).json({ success: false, error: 'Avatar no encontrado.' });
  res.status(200).json({ success: true, avatar });
});

export default router;
