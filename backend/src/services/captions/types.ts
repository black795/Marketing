/**
 * Tipos compartidos de la capa de proveedores de captions.
 *
 * La arquitectura es extensible: cada proveedor (Captions AI, Submagic,
 * Capsubs, Whisper local) implementa `CaptionsProvider` y se registra en
 * registry.ts. Agregar uno nuevo no toca el resto del sistema.
 */

/** Estado de una prueba de conexión con un proveedor. */
export type CaptionsConnectionStatus =
  | 'connected'
  | 'invalid'
  | 'timeout'
  | 'error'
  | 'not_configured';

export interface CaptionsTestResult {
  ok: boolean;
  status: CaptionsConnectionStatus;
  /** Mensaje legible para mostrar en la UI. */
  detail?: string;
  /** Latencia de la prueba en ms. */
  latencyMs?: number;
}

/** Metadatos estáticos de un proveedor (para poblar la UI). */
export interface CaptionsProviderInfo {
  id: string;
  label: string;
  /** Si necesita una API key externa (Whisper local no la necesita). */
  requiresApiKey: boolean;
  /** false = registrado pero su pipeline aún no está implementado. */
  implemented: boolean;
  /** Nota corta para la UI. */
  description: string;
}

/** Una plantilla de estilo de captions (look del subtítulo). */
export interface CaptionTemplate {
  id: string;
  name: string;
  /** URL a un video de preview del estilo. */
  previewUrl: string | null;
}

/** Estado normalizado de un job de captioning. */
export type CaptionJobStatus = 'processing' | 'complete' | 'failed' | 'cancelled';

export interface CaptionJob {
  /** id del job en el proveedor. */
  id: string;
  status: CaptionJobStatus;
  /** Progreso 0-100, o null si el proveedor no lo reporta. */
  progress: number | null;
  /** Detalle del error cuando status === 'failed'. */
  error?: string;
}

/** Entrada para enviar un job de captioning. */
export interface SubmitCaptionInput {
  apiKey: string;
  /** id de la plantilla de estilo elegida. */
  captionTemplateId: string;
  /** Bytes del video a subtitular (se sube como multipart). */
  videoBytes: Buffer;
  /** Nombre de archivo para el upload multipart. */
  videoFilename: string;
}

/** Se lanza cuando un proveedor stub no implementa una operación. */
export class CaptionsNotImplementedError extends Error {
  constructor(provider: string) {
    super(
      `El proveedor de captions "${provider}" todavía no implementa esta operación.`
    );
    this.name = 'CaptionsNotImplementedError';
  }
}

/**
 * Contrato que implementa cada proveedor de captions.
 *
 * Fase 1 usaba solo `testConnection`. Fase 2 añade el ciclo de captioning:
 * listar plantillas, enviar el job y polear su estado.
 */
export interface CaptionsProvider {
  readonly info: CaptionsProviderInfo;

  /**
   * Verifica que la API key sea válida y el servicio responda.
   * `apiKey` puede ser null para proveedores que no la requieren.
   */
  testConnection(
    apiKey: string | null,
    signal?: AbortSignal
  ): Promise<CaptionsTestResult>;

  /** Lista las plantillas de estilo de captions disponibles. */
  listTemplates(apiKey: string, signal?: AbortSignal): Promise<CaptionTemplate[]>;

  /** Envía un job de captioning. Devuelve el job recién creado. */
  submitCaptionJob(
    input: SubmitCaptionInput,
    signal?: AbortSignal
  ): Promise<CaptionJob>;

  /** Consulta el estado actual de un job (para polling). */
  getCaptionJob(
    apiKey: string,
    jobId: string,
    signal?: AbortSignal
  ): Promise<CaptionJob>;

  /** Devuelve la URL del video subtitulado terminado. */
  getCaptionedVideoUrl(
    apiKey: string,
    jobId: string,
    signal?: AbortSignal
  ): Promise<string>;
}
