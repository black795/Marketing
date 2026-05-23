'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  getCaptionConfig,
  updateCaptionConfig,
  saveProviderKey,
  deleteProviderKey,
  setProviderEnabled,
  testProviderConnection,
} from '@/lib/captions-api';
import type {
  CaptionConfig,
  CaptionConnectionStatus,
  CaptionProvider,
} from '@/types/captions';
import { dlog } from '@/lib/debug-log';
import LoadingButton from '@/components/loading/LoadingButton';
import Spinner from '@/components/loading/Spinner';

/**
 * Panel 🎙️ Caption Provider — selección de proveedor, API key segura,
 * prueba de conexión y configuración global de captions.
 *
 * La API key se envía al backend para guardarse; el frontend solo recibe
 * de vuelta una versión enmascarada y un estado de conexión.
 */
export default function CaptionProviderPanel() {
  const fieldId = useId();
  const [config, setConfig] = useState<CaptionConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [testStatus, setTestStatus] = useState<CaptionConnectionStatus>('idle');
  const [testDetail, setTestDetail] = useState<string>('');

  const reload = useCallback(async () => {
    try {
      const cfg = await getCaptionConfig();
      setConfig(cfg);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'No se pudo cargar la configuración'
      );
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError} — ¿está corriendo el backend en :4000?
      </div>
    );
  }
  if (!config) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Spinner size={16} className="text-brand-pink" /> Cargando configuración…
      </div>
    );
  }

  const active: CaptionProvider | undefined = config.providers.find(
    (p) => p.id === config.activeProvider
  );

  // Resetea el estado de prueba al cambiar de proveedor.
  function resetTest() {
    setTestStatus('idle');
    setTestDetail('');
    setKeyInput('');
    setShowKey(false);
  }

  async function handleSelectProvider(id: string) {
    setBusy(true);
    try {
      const next = await updateCaptionConfig({ activeProvider: id });
      setConfig(next);
      resetTest();
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchConfig(
    patch: Parameters<typeof updateCaptionConfig>[0]
  ) {
    setBusy(true);
    try {
      setConfig(await updateCaptionConfig(patch));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleEnabled() {
    if (!active) return;
    setBusy(true);
    try {
      setConfig(await setProviderEnabled(active.id, !active.enabled));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveKey() {
    if (!active || keyInput.trim().length === 0) return;
    setSaving(true);
    try {
      await saveProviderKey(active.id, keyInput.trim());
      dlog('captions', 'key guardada — recargando config');
      await reload();
      setKeyInput('');
      setShowKey(false);
      setTestStatus('idle');
      setTestDetail('API key guardada. Pulsa “Probar conexión” para validarla.');
    } catch (err) {
      setTestStatus('error');
      setTestDetail(
        err instanceof Error ? err.message : 'No se pudo guardar la key'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey() {
    if (!active) return;
    setBusy(true);
    try {
      await deleteProviderKey(active.id);
      await reload();
      resetTest();
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!active) return;
    setTestStatus('testing');
    setTestDetail('');
    const result = await testProviderConnection(
      active.id,
      keyInput.trim() || undefined
    );
    setTestStatus(result.status);
    setTestDetail(
      result.detail
        ? result.latencyMs
          ? `${result.detail} (${result.latencyMs}ms)`
          : result.detail
        : result.ok
        ? 'Conexión correcta'
        : 'Fallo de conexión'
    );
  }

  return (
    <div className="space-y-5">
      {/* Selección de proveedor */}
      <div>
        <label
          htmlFor={`${fieldId}-provider`}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Proveedor de captions
        </label>
        <select
          id={`${fieldId}-provider`}
          value={config.activeProvider}
          onChange={(e) => handleSelectProvider(e.target.value)}
          disabled={busy}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
        >
          {config.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.implemented ? '' : ' (próximamente)'}
            </option>
          ))}
        </select>
        {active && (
          <p className="mt-1.5 text-xs text-neutral-500">{active.description}</p>
        )}
      </div>

      {active && (
        <>
          {!active.implemented && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Este proveedor está registrado en la arquitectura pero su
              integración todavía no está implementada.
            </div>
          )}

          {/* API Key */}
          {active.requiresApiKey ? (
            <div>
              <label
                htmlFor={`${fieldId}-key`}
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                API Key
              </label>

              {active.hasKey && (
                <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  🔒 Key guardada: {active.maskedKey}
                  <span className="font-normal text-emerald-600">
                    ({active.keySource === 'env' ? 'variable de entorno' : 'guardada en backend'})
                  </span>
                </p>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id={`${fieldId}-key`}
                    type={showKey ? 'text' : 'password'}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    disabled={saving || busy}
                    placeholder={
                      active.hasKey
                        ? 'Escribe una nueva key para reemplazarla…'
                        : 'Pega tu API key…'
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 font-mono text-sm text-neutral-800 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink disabled:bg-neutral-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}
                    title={showKey ? 'Ocultar' : 'Mostrar'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                  >
                    {showKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <LoadingButton
                  variant="secondary"
                  onClick={handleSaveKey}
                  loading={saving}
                  loadingLabel="Guardando…"
                  disabled={keyInput.trim().length === 0 || busy}
                >
                  Guardar
                </LoadingButton>
              </div>

              <div className="mt-1.5 flex items-center gap-3">
                <p className="text-[11px] text-neutral-400">
                  La key se guarda solo en el backend. Nunca se expone al
                  navegador.
                </p>
                {active.hasKey && active.keySource === 'store' && (
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    disabled={busy}
                    className="ml-auto shrink-0 text-[11px] font-semibold text-neutral-500 hover:text-red-600"
                  >
                    Eliminar key
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-neutral-100 px-3 py-2 text-[11px] text-neutral-600">
              Este proveedor funciona localmente y no requiere API key.
            </div>
          )}

          {/* Probar conexión + estado */}
          <div>
            <div className="flex items-center gap-3">
              <LoadingButton
                variant="primary"
                onClick={handleTest}
                loading={testStatus === 'testing'}
                loadingLabel="Probando…"
                disabled={busy}
              >
                Probar conexión
              </LoadingButton>
              <StatusBadge status={testStatus} />
            </div>
            {testDetail && (
              <p
                className={`mt-2 text-xs ${
                  testStatus === 'connected'
                    ? 'text-emerald-700'
                    : testStatus === 'testing' || testStatus === 'idle'
                    ? 'text-neutral-500'
                    : 'text-red-600'
                }`}
              >
                {testDetail}
              </p>
            )}
          </div>

          {/* Habilitar proveedor */}
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={active.enabled}
              onChange={handleToggleEnabled}
              disabled={busy}
              className="h-4 w-4 accent-brand-pink"
            />
            <span className="text-xs font-semibold text-neutral-700">
              Proveedor habilitado para usarse en el editor de captions
            </span>
          </label>
        </>
      )}

      {/* Configuración global */}
      <div className="space-y-3 border-t border-neutral-200 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Configuración global
        </h3>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={config.captionsEnabled}
            onChange={(e) => handlePatchConfig({ captionsEnabled: e.target.checked })}
            disabled={busy}
            className="mt-0.5 h-4 w-4 accent-brand-pink"
          />
          <span>
            <span className="block text-xs font-semibold text-neutral-700">
              Captions activadas
            </span>
            <span className="block text-[11px] text-neutral-400">
              Si se desactiva, el editor de captions queda deshabilitado.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={config.fallbackEnabled}
            onChange={(e) => handlePatchConfig({ fallbackEnabled: e.target.checked })}
            disabled={busy}
            className="mt-0.5 h-4 w-4 accent-brand-pink"
          />
          <span>
            <span className="block text-xs font-semibold text-neutral-700">
              Fallback automático
            </span>
            <span className="block text-[11px] text-neutral-400">
              Si el proveedor activo falla, intentar el siguiente habilitado.
            </span>
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Modo de captions
          </span>
          <div className="flex gap-2">
            {(['auto', 'manual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => handlePatchConfig({ mode: m })}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  config.mode === m
                    ? 'border-brand-pink bg-brand-pink/10 text-brand-pink'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-pink'
                }`}
              >
                {m === 'auto' ? 'Automático' : 'Manual'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            {config.mode === 'auto'
              ? 'El sistema genera y sincroniza las captions sin intervención.'
              : 'Controlas cada paso de la generación de captions.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CaptionConnectionStatus }) {
  const cfg: Record<
    CaptionConnectionStatus,
    { label: string; tone: string }
  > = {
    idle: { label: 'Sin probar', tone: 'bg-neutral-100 text-neutral-500' },
    testing: { label: 'Probando…', tone: 'bg-brand-pink/10 text-brand-pink' },
    connected: { label: 'Conectado', tone: 'bg-emerald-100 text-emerald-700' },
    invalid: { label: 'Key inválida', tone: 'bg-red-100 text-red-700' },
    timeout: { label: 'Timeout', tone: 'bg-amber-100 text-amber-800' },
    error: { label: 'Error de API', tone: 'bg-red-100 text-red-700' },
    not_configured: {
      label: 'No configurado',
      tone: 'bg-neutral-100 text-neutral-500',
    },
  };
  const c = cfg[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${c.tone}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === 'connected'
            ? 'bg-emerald-500'
            : status === 'invalid' || status === 'error'
            ? 'bg-red-500'
            : status === 'timeout'
            ? 'bg-amber-500'
            : status === 'testing'
            ? 'animate-pulse bg-brand-pink'
            : 'bg-neutral-400'
        }`}
      />
      {c.label}
    </span>
  );
}
