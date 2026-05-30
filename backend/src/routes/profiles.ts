import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../services/logger';
import {
  loadProfiles,
  getProfile,
  upsertProfile,
  deleteProfile,
  addExample,
  removeExample,
  recordUse,
  persistReferenceImage,
  type ProfileExampleKind,
} from '../services/profiles';

/**
 * API de Perfiles / Dominios de uso.
 *
 *   GET    /api/profiles                          — todos
 *   GET    /api/profiles/:id                      — uno
 *   POST   /api/profiles                          — crear/editar
 *   DELETE /api/profiles/:id                      — borrar
 *   POST   /api/profiles/:id/examples             — añadir ejemplo {kind,text}
 *   DELETE /api/profiles/:id/examples/:exampleId  — quitar ejemplo
 *   POST   /api/profiles/:id/used                 — marcar usado (telemetría)
 */
const router = Router();
const log = createLogger('profiles-api');

router.get('/profiles', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, registry: loadProfiles() });
});

router.get('/profiles/:id', (req: Request, res: Response) => {
  const p = getProfile(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
  res.status(200).json({ success: true, profile: p });
});

router.post('/profiles', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = (req.body || {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return res.status(400).json({ success: false, error: 'El perfil necesita un nombre.' });

  const profileId = (body.id as string) || randomUUID();

  try {
    // persistir referencias visuales que vengan como data: URL
    const refsIn = Array.isArray(body.referenceImages) ? (body.referenceImages as string[]) : [];
    const referenceImages: string[] = [];
    for (let i = 0; i < refsIn.length; i++) {
      referenceImages.push(await persistReferenceImage(refsIn[i], profileId, i));
    }

    const profile = upsertProfile({
      id: profileId,
      name,
      domain: typeof body.domain === 'string' ? body.domain : undefined,
      systemContext: typeof body.systemContext === 'string' ? body.systemContext : undefined,
      tone: typeof body.tone === 'string' ? body.tone : undefined,
      dos: typeof body.dos === 'string' ? body.dos : undefined,
      donts: typeof body.donts === 'string' ? body.donts : undefined,
      avatarIds: Array.isArray(body.avatarIds) ? (body.avatarIds as string[]) : undefined,
      referenceImages: refsIn.length > 0 ? referenceImages : undefined,
    });
    res.status(200).json({ success: true, profile });
  } catch (err) {
    log.error('no se pudo guardar perfil', { requestId }, err);
    const msg = err instanceof Error ? err.message : 'error desconocido';
    res.status(400).json({ success: false, error: `No se pudo guardar el perfil: ${msg}` });
  }
});

router.delete('/profiles/:id', (req: Request, res: Response) => {
  const ok = deleteProfile(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
  res.status(200).json({ success: true });
});

router.post('/profiles/:id/examples', (req: Request, res: Response) => {
  const { kind, text } = (req.body || {}) as { kind?: string; text?: string };
  if (kind !== 'prompt' && kind !== 'script') {
    return res.status(400).json({ success: false, error: 'kind debe ser "prompt" o "script".' });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Falta el texto del ejemplo.' });
  }
  const profile = addExample(req.params.id, kind as ProfileExampleKind, text.trim());
  if (!profile) return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
  res.status(200).json({ success: true, profile });
});

router.delete('/profiles/:id/examples/:exampleId', (req: Request, res: Response) => {
  const profile = removeExample(req.params.id, req.params.exampleId);
  if (!profile) return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
  res.status(200).json({ success: true, profile });
});

router.post('/profiles/:id/used', (req: Request, res: Response) => {
  const profile = recordUse(req.params.id);
  if (!profile) return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
  res.status(200).json({ success: true, profile });
});

export default router;
