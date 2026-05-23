/**
 * Tipos del subsistema de captions (sección ⚙️ Configuración de APIs).
 * Espejo de lo que expone el backend en /api/captions/*.
 */

export type CaptionConnectionStatus =
  | 'idle'
  | 'testing'
  | 'connected'
  | 'invalid'
  | 'timeout'
  | 'error'
  | 'not_configured';

export type CaptionMode = 'auto' | 'manual';

/** Un proveedor de captions tal como lo describe el backend. */
export interface CaptionProvider {
  id: string;
  label: string;
  description: string;
  requiresApiKey: boolean;
  /** false = registrado pero su pipeline aún no está implementado. */
  implemented: boolean;
  enabled: boolean;
  hasKey: boolean;
  /** Key enmascarada (ej. ••••1234). El frontend nunca ve la key real. */
  maskedKey: string;
  keySource: 'store' | 'env' | 'none';
}

export interface CaptionConfig {
  activeProvider: string;
  captionsEnabled: boolean;
  mode: CaptionMode;
  fallbackEnabled: boolean;
  providers: CaptionProvider[];
}

export interface CaptionTestResult {
  ok: boolean;
  status: CaptionConnectionStatus;
  detail?: string;
  latencyMs?: number;
}

// --- Fase 2: editor de captions ---------------------------------------------

/** Una plantilla de estilo de captions. */
export interface CaptionTemplate {
  id: string;
  name: string;
  /** URL a un video de preview del estilo. */
  previewUrl: string | null;
}

/** Fases del ciclo de vida de un job de captioning. */
export type CaptionJobPhase =
  | 'idle'
  | 'connecting'
  | 'uploading'
  | 'submitting'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Resultado de un job de captioning terminado. */
export interface CaptionJobResult {
  jobId: string;
  /** URL del proveedor (puede expirar). */
  videoUrl: string;
  /** URL local persistida por el backend. null si falló el persist. */
  localUrl: string | null;
}
