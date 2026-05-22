import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import generateStoryRouter from './routes/generate-story';
import regenerateImagesRouter from './routes/regenerate-images';
import generateScriptRouter from './routes/generate-script';
import generateImagesFromScriptRouter from './routes/generate-images-from-script';
import generateVideosFromScenesRouter from './routes/generate-videos-from-scenes';
import { checkWorkerHealth } from './services/python-worker/imageWorker';
import { createLogger, newId } from './services/logger';
import { metrics, recordStatus, snapshotMetrics } from './services/metrics';

const log = createLogger('backend');
const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

app.use(express.json({ limit: '50mb' }));

// Sirve los assets persistidos (videos descargados, futuros renders, etc.)
// Path absoluto desde la raíz del repo: <root>/assets/...
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');
app.use('/assets', express.static(ASSETS_DIR));

// =====================================================================
// Middleware global de logging + trazabilidad.
//
// Asigna un requestId único a cada request, lo expone en res.locals (lo
// leen las rutas) y en la cabecera X-Request-Id (lo puede leer el
// frontend / Python para correlacionar). Mide la duración y registra
// tanto el cierre normal como la desconexión prematura del cliente.
// =====================================================================
app.use((req, res, next) => {
  const requestId = newId('req');
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const reqLog = log.child({ requestId });
  const startedAt = Date.now();

  metrics.httpRequestsTotal += 1;
  metrics.httpRequestsInFlight += 1;

  reqLog.info(`→ ${req.method} ${req.originalUrl}`);

  // 'finish' y 'close' pueden dispararse ambos; settle garantiza una sola
  // contabilización por request.
  let settled = false;
  const settle = (how: 'finish' | 'close') => {
    if (settled) return;
    settled = true;
    metrics.httpRequestsInFlight = Math.max(0, metrics.httpRequestsInFlight - 1);
    const elapsed = Date.now() - startedAt;

    if (how === 'close' && !res.writableEnded) {
      // El cliente se desconectó antes de que termináramos la respuesta.
      reqLog.warn(
        `✗ ${req.method} ${req.originalUrl} — conexión cerrada por el cliente (${elapsed}ms)`
      );
      return;
    }
    recordStatus(res.statusCode);
    reqLog.info(
      `← ${req.method} ${req.originalUrl} ${res.statusCode} (${elapsed}ms)`
    );
  };

  res.on('finish', () => settle('finish'));
  res.on('close', () => settle('close'));

  next();
});

// =====================================================================
// Endpoints de monitoreo / debugging.
// =====================================================================

/** Estado del gateway y del worker Python (200 ok / 503 degradado). */
app.get('/health', async (_req, res) => {
  const worker = await checkWorkerHealth();
  const healthy = worker.ok;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    worker,
    timestamp: new Date().toISOString(),
  });
});

/** Métricas en memoria: tráfico HTTP, streams SSE, generaciones, recursos. */
app.get('/metrics', (_req, res) => {
  res.status(200).json(snapshotMetrics());
});

/** Lista las rutas registradas — útil para verificar el wiring del router. */
app.get('/debug/routes', (_req, res) => {
  res.status(200).json({ routes: listRoutes(app) });
});

// =====================================================================
// Rutas de la API.
// =====================================================================
app.use('/api', generateStoryRouter);
app.use('/api', regenerateImagesRouter);
app.use('/api', generateScriptRouter);
app.use('/api', generateImagesFromScriptRouter);
app.use('/api', generateVideosFromScenesRouter);

// 404 — ninguna ruta coincidió.
app.use((req, res) => {
  log.warn(`404 sin ruta para ${req.method} ${req.originalUrl}`, {
    requestId: res.locals.requestId as string,
  });
  res.status(404).json({
    success: false,
    error: `No route for ${req.method} ${req.originalUrl}`,
    requestId: res.locals.requestId,
  });
});

// =====================================================================
// Middleware global de errores. Registra stack trace completo y devuelve
// el requestId para poder cruzar el error del cliente con los logs.
// =====================================================================
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const requestId = res.locals.requestId as string | undefined;
    log.error('error no controlado en una request', { requestId, path: req.originalUrl }, err);

    if (res.headersSent) {
      // La respuesta ya empezó (p. ej. un stream SSE): no podemos cambiar
      // el status; delegamos a Express para que cierre la conexión.
      return next(err);
    }
    res.status(500).json({
      success: false,
      error: err.message,
      requestId,
    });
  }
);

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  log.info(`Tim Koda gateway escuchando en http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------
// Helper: introspección de rutas para /debug/routes.
// ---------------------------------------------------------------------
function listRoutes(application: express.Express): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  // El stack interno de Express no está tipado públicamente.
  const stack: any[] = (application as any)._router?.stack ?? [];

  const walk = (layers: any[], prefix: string) => {
    for (const layer of layers) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods)
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());
        for (const method of methods) {
          out.push({ method, path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Todos nuestros sub-routers se montan bajo /api.
        walk(layer.handle.stack, prefix + '/api');
      }
    }
  };

  walk(stack, '');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
