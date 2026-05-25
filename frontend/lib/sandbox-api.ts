/**
 * Cliente del sandbox / mock mode.
 *
 * Conecta con /api/sandbox/status del gateway. El badge global y el toggle
 * de /settings comparten este hook — un solo poll, una sola fuente de verdad.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface SandboxStatus {
  enabled: boolean;
  updatedAt: string;
  /** "env" → forzado por entorno, toggle deshabilitado. */
  source: 'env' | 'file' | 'default';
}

export async function fetchSandboxStatus(): Promise<SandboxStatus> {
  const res = await fetch(`${BACKEND_URL}/api/sandbox/status`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`sandbox status ${res.status}`);
  const body = (await res.json()) as { enabled: boolean; updatedAt: string; source: SandboxStatus['source'] };
  return { enabled: body.enabled, updatedAt: body.updatedAt, source: body.source };
}

export async function setSandboxStatus(enabled: boolean): Promise<SandboxStatus> {
  const res = await fetch(`${BACKEND_URL}/api/sandbox/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`sandbox PUT ${res.status}`);
  const body = (await res.json()) as { enabled: boolean; updatedAt: string; source: SandboxStatus['source'] };
  return { enabled: body.enabled, updatedAt: body.updatedAt, source: body.source };
}

/**
 * Hook compartido. Hace un primer fetch + revalida cada 8s para reflejar
 * cambios hechos desde otra pestaña / curl. Devuelve también `toggle`
 * optimista para los componentes que ofrezcan controlarlo.
 */
export function useSandboxStatus(): {
  status: SandboxStatus | null;
  loading: boolean;
  error: string | null;
  toggle: (next: boolean) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSandboxStatus();
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sandbox unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const toggle = useCallback(async (next: boolean) => {
    // Optimismo: actualizamos en pantalla antes de que vuelva la respuesta.
    setStatus((s) => (s ? { ...s, enabled: next } : s));
    try {
      const fresh = await setSandboxStatus(next);
      setStatus(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sandbox toggle failed');
      await refresh();
    }
  }, [refresh]);

  return { status, loading, error, toggle, refresh };
}
