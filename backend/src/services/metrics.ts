/**
 * Registro de métricas en memoria del gateway.
 *
 * Sin persistencia: se reinicia con el proceso. Es suficiente para alimentar
 * el endpoint /metrics y depurar en desarrollo (cuántos streams SSE hay
 * activos, cuántas desconexiones reales hubo, cuántas regeneraciones, etc.).
 *
 * Todos los contadores se mutan directamente desde el middleware de logging
 * (server.ts), desde openSseStream (sse.ts) y desde las rutas de generación.
 */

export interface GatewayMetrics {
  startedAt: number;
  httpRequestsTotal: number;
  httpRequestsInFlight: number;
  httpResponsesByStatus: Record<string, number>;
  sseStreamsOpened: number;
  sseStreamsActive: number;
  /** Desconexiones REALES de cliente (res.on('close') con !writableEnded). */
  sseClientDisconnects: number;
  imageGenerations: number;
  imageGenerationFailures: number;
  /** Jobs de regeneración cancelados por desconexión real del cliente. */
  cancellations: number;
}

export const metrics: GatewayMetrics = {
  startedAt: Date.now(),
  httpRequestsTotal: 0,
  httpRequestsInFlight: 0,
  httpResponsesByStatus: {},
  sseStreamsOpened: 0,
  sseStreamsActive: 0,
  sseClientDisconnects: 0,
  imageGenerations: 0,
  imageGenerationFailures: 0,
  cancellations: 0,
};

/** Suma 1 al contador de respuestas para un status HTTP dado. */
export function recordStatus(status: number): void {
  const key = String(status);
  metrics.httpResponsesByStatus[key] = (metrics.httpResponsesByStatus[key] || 0) + 1;
}

/** Snapshot serializable para el endpoint /metrics (incluye recursos del proceso). */
export function snapshotMetrics() {
  const mem = process.memoryUsage();
  return {
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    http: {
      total: metrics.httpRequestsTotal,
      inFlight: metrics.httpRequestsInFlight,
      byStatus: metrics.httpResponsesByStatus,
    },
    sse: {
      opened: metrics.sseStreamsOpened,
      active: metrics.sseStreamsActive,
      clientDisconnects: metrics.sseClientDisconnects,
    },
    generation: {
      images: metrics.imageGenerations,
      imageFailures: metrics.imageGenerationFailures,
      cancellations: metrics.cancellations,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      rssMb: +(mem.rss / 1048576).toFixed(1),
      heapUsedMb: +(mem.heapUsed / 1048576).toFixed(1),
      heapTotalMb: +(mem.heapTotal / 1048576).toFixed(1),
    },
    timestamp: new Date().toISOString(),
  };
}
