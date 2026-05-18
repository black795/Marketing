import type { Response } from 'express';

export interface SseEvent {
  event: string;
  data: unknown;
}

export function openSseStream(res: Response): {
  send: (e: SseEvent) => void;
  close: () => void;
} {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // initial comment para que algunos proxies abran el stream
  res.write(`: stream open\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      /* ignore */
    }
  }, 15_000);

  let closed = false;
  function send(e: SseEvent) {
    if (closed) return;
    res.write(`event: ${e.event}\n`);
    res.write(`data: ${JSON.stringify(e.data)}\n\n`);
  }
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
  return { send, close };
}
