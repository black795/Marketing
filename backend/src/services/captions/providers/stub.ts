/**
 * Fábrica de proveedores "stub" — registrados en la arquitectura pero con
 * su pipeline todavía sin implementar.
 *
 * Existen para que la UI los muestre en el dropdown y para que sumar la
 * integración real (Submagic, Capsubs, Whisper local) sea solo rellenar
 * `testConnection` / `submitCaptionJob`, sin tocar el registry ni las rutas.
 *
 * Son honestos: `testConnection` informa con claridad que aún no están
 * operativos en lugar de fingir una conexión.
 */
import {
  CaptionsNotImplementedError,
  type CaptionsProvider,
  type CaptionsProviderInfo,
  type CaptionsTestResult,
} from '../types';

export function makeStubProvider(
  info: Omit<CaptionsProviderInfo, 'implemented'>
): CaptionsProvider {
  const fullInfo: CaptionsProviderInfo = { ...info, implemented: false };
  // Las operaciones de captioning lanzan un error claro en vez de fingir.
  const notImplemented = () => {
    throw new CaptionsNotImplementedError(info.label);
  };
  return {
    info: fullInfo,
    async testConnection(): Promise<CaptionsTestResult> {
      return {
        ok: false,
        status: 'not_configured',
        detail: `${info.label} está registrado pero su integración aún no está implementada.`,
      };
    },
    async listTemplates() {
      return notImplemented();
    },
    async submitCaptionJob() {
      return notImplemented();
    },
    async getCaptionJob() {
      return notImplemented();
    },
    async getCaptionedVideoUrl() {
      return notImplemented();
    },
  };
}

/** Submagic — captioning para redes sociales. Pendiente de implementar. */
export const submagicProvider = makeStubProvider({
  id: 'submagic',
  label: 'Submagic',
  requiresApiKey: true,
  description: 'Subtítulos virales automáticos. Integración planificada.',
});

/** Capsubs — captioning alternativo. Pendiente de implementar. */
export const capsubsProvider = makeStubProvider({
  id: 'capsubs',
  label: 'Capsubs',
  requiresApiKey: true,
  description: 'Proveedor alternativo de subtítulos. Integración planificada.',
});

/** Whisper local — transcripción on-device, sin API key. Pendiente. */
export const whisperLocalProvider = makeStubProvider({
  id: 'whisper-local',
  label: 'Whisper Local',
  requiresApiKey: false,
  description:
    'Transcripción local con Whisper, sin servicios externos ni costo por uso.',
});
