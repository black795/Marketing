/**
 * Tipos del modo Avatar (prunaai/p-video-avatar).
 *
 * Mantenidos aparte de types/story.ts para no tocar el flujo de Scripts.
 */

export type AvatarResolution = '720p' | '1080p';

/** Cómo habla el avatar: texto sintetizado (TTS) o audio propio subido. */
export type AvatarVoiceMode = 'tts' | 'audio';

/** Estados del ciclo de vida de una generación de avatar. */
export type AvatarPhase =
  | 'idle'
  | 'connecting'
  | 'queued'
  | 'processing'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Motor de generación del avatar. */
export type AvatarModel = 'p_video_avatar' | 'omni_human';

/** Payload que el frontend manda al gateway (POST /api/generate-avatar). */
export interface AvatarGenerationRequest {
  /**
   * Motor: "p_video_avatar" (default, TTS desde texto o audio) u
   * "omni_human" (más realista, REQUIERE audio).
   */
  model?: AvatarModel;
  /** Imagen del avatar como data: URL. */
  image: string;
  resolution: AvatarResolution;
  /** Audio propio como data: URL. Si está presente, manda sobre los voice_*. */
  audio?: string;
  voiceScript?: string;
  voice?: string;
  voicePrompt?: string;
  voiceLanguage?: string;
  videoPrompt?: string;
  seed?: number | null;
  disableSafetyFilter?: boolean;
  disablePromptUpsampling?: boolean;
}

/** Resultado final de una generación exitosa. */
export interface AvatarResult {
  jobId: string;
  /** URL temporal de Replicate (puede expirar). */
  videoUrl: string;
  /** URL local persistida por el backend (no expira). null si falló el persist. */
  localUrl: string | null;
}
