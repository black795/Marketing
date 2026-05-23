import { Router, Request, Response } from 'express';
import { createLogger } from '../services/logger';
import { maskSecret } from '../services/secrets';
import { listProviders, getProvider, isKnownProvider } from '../services/captions/registry';
import {
  getCaptionsConfig,
  updateCaptionsConfig,
  getProviderConfig,
  setProviderKey,
  clearProviderKey,
  setProviderEnabled,
  resolveProviderKey,
  describeProviderKey,
  type CaptionsMode,
} from '../services/captions/store';

/**
 * Rutas de configuración de captions (sección ⚙️ Configuración de APIs).
 *
 * Todo es proxy backend: las API keys se guardan y se usan SOLO aquí. El
 * frontend nunca recibe una key en claro — solo su versión enmascarada.
 */

const router = Router();
const log = createLogger('captions-api');

/** Serializa la config + el catálogo de proveedores para el frontend. */
function buildConfigPayload() {
  const cfg = getCaptionsConfig();
  const providers = listProviders().map((p) => {
    const id = p.info.id;
    const keyInfo = describeProviderKey(id);
    return {
      id,
      label: p.info.label,
      description: p.info.description,
      requiresApiKey: p.info.requiresApiKey,
      implemented: p.info.implemented,
      enabled: getProviderConfig(id).enabled,
      hasKey: keyInfo.hasKey,
      maskedKey: keyInfo.maskedKey,
      keySource: keyInfo.source,
    };
  });
  return {
    activeProvider: cfg.activeProvider,
    captionsEnabled: cfg.captionsEnabled,
    mode: cfg.mode,
    fallbackEnabled: cfg.fallbackEnabled,
    providers,
  };
}

// GET /api/captions/config — config actual + catálogo de proveedores.
router.get('/captions/config', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, ...buildConfigPayload() });
});

// GET /api/captions/templates — plantillas de estilo del proveedor activo.
router.get('/captions/templates', async (_req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const cfg = getCaptionsConfig();
  const provider = getProvider(cfg.activeProvider);

  if (!provider) {
    return res.status(400).json({ success: false, error: 'Proveedor activo desconocido' });
  }
  if (!provider.info.implemented) {
    return res.status(400).json({
      success: false,
      error: `El proveedor "${provider.info.label}" todavía no soporta plantillas.`,
    });
  }
  const apiKey = resolveProviderKey(cfg.activeProvider);
  if (provider.info.requiresApiKey && !apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Falta la API key del proveedor. Configúrala en ⚙️ Configuración de APIs.',
    });
  }

  try {
    const templates = await provider.listTemplates(apiKey || '');
    res.status(200).json({ success: true, provider: cfg.activeProvider, templates });
  } catch (err) {
    log.error('error listando plantillas de captions', { requestId }, err);
    res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error listando plantillas',
    });
  }
});

// PUT /api/captions/config — actualiza proveedor activo / modo / flags.
router.put('/captions/config', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const body = req.body as {
    activeProvider?: string;
    captionsEnabled?: boolean;
    mode?: CaptionsMode;
    fallbackEnabled?: boolean;
  };

  const patch: Parameters<typeof updateCaptionsConfig>[0] = {};

  if (body.activeProvider !== undefined) {
    if (!isKnownProvider(body.activeProvider)) {
      log.warn('proveedor desconocido en PUT /config', { requestId });
      return res.status(400).json({
        success: false,
        error: `Proveedor desconocido: ${body.activeProvider}`,
      });
    }
    patch.activeProvider = body.activeProvider;
  }
  if (typeof body.captionsEnabled === 'boolean') {
    patch.captionsEnabled = body.captionsEnabled;
  }
  if (body.mode === 'auto' || body.mode === 'manual') {
    patch.mode = body.mode;
  }
  if (typeof body.fallbackEnabled === 'boolean') {
    patch.fallbackEnabled = body.fallbackEnabled;
  }

  updateCaptionsConfig(patch);
  log.info('config de captions actualizada', { requestId, ...patch });
  res.status(200).json({ success: true, ...buildConfigPayload() });
});

// POST /api/captions/:providerId/key — guarda la API key del proveedor.
router.post('/captions/:providerId/key', (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { providerId } = req.params;
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

  if (!isKnownProvider(providerId)) {
    return res.status(404).json({ success: false, error: 'Proveedor desconocido' });
  }
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'API key vacía' });
  }

  setProviderKey(providerId, apiKey);
  // NUNCA loguear la key en claro — solo la versión enmascarada.
  log.info(`API key guardada para ${providerId}`, {
    requestId,
    maskedKey: maskSecret(apiKey),
  });

  res.status(200).json({
    success: true,
    providerId,
    maskedKey: maskSecret(apiKey),
  });
});

// DELETE /api/captions/:providerId/key — borra la API key guardada.
router.delete('/captions/:providerId/key', (req: Request, res: Response) => {
  const { providerId } = req.params;
  if (!isKnownProvider(providerId)) {
    return res.status(404).json({ success: false, error: 'Proveedor desconocido' });
  }
  clearProviderKey(providerId);
  log.info(`API key eliminada para ${providerId}`, {
    requestId: res.locals.requestId as string,
  });
  res.status(200).json({ success: true, providerId });
});

// POST /api/captions/:providerId/enabled — habilita/deshabilita un proveedor.
router.post('/captions/:providerId/enabled', (req: Request, res: Response) => {
  const { providerId } = req.params;
  const enabled = req.body?.enabled === true;
  if (!isKnownProvider(providerId)) {
    return res.status(404).json({ success: false, error: 'Proveedor desconocido' });
  }
  setProviderEnabled(providerId, enabled);
  res.status(200).json({ success: true, ...buildConfigPayload() });
});

// POST /api/captions/:providerId/test — prueba la conexión con el proveedor.
router.post('/captions/:providerId/test', async (req: Request, res: Response) => {
  const requestId = res.locals.requestId as string;
  const { providerId } = req.params;

  const provider = getProvider(providerId);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Proveedor desconocido' });
  }

  // Permite probar una key recién tipeada (aún sin guardar) o la ya guardada.
  const bodyKey =
    typeof req.body?.apiKey === 'string' && req.body.apiKey.trim().length > 0
      ? req.body.apiKey.trim()
      : null;
  const apiKey = bodyKey ?? resolveProviderKey(providerId);

  const startedAt = Date.now();
  log.info(`probando conexión con ${providerId}`, {
    requestId,
    maskedKey: maskSecret(apiKey ?? ''),
  });

  try {
    const result = await provider.testConnection(apiKey);
    log.info(
      `test ${providerId} → ${result.status} (${Date.now() - startedAt}ms)`,
      { requestId }
    );
    res.status(200).json({ success: true, providerId, ...result });
  } catch (err) {
    log.error(`error inesperado probando ${providerId}`, { requestId }, err);
    res.status(200).json({
      success: true,
      providerId,
      ok: false,
      status: 'error',
      detail: err instanceof Error ? err.message : 'Error interno',
    });
  }
});

export default router;
