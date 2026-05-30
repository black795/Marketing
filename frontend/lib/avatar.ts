/**
 * Constantes, defaults y validaciones del modo Avatar.
 *
 * Los enums (voces, idiomas, resoluciones) reflejan EXACTAMENTE el schema
 * real de prunaai/p-video-avatar en Replicate. No agregar valores que la
 * API no acepte.
 */
import type {
  AvatarGenerationRequest,
  AvatarResolution,
  AvatarVoiceMode,
} from '@/types/avatar';

// --- Enums reales de la API -------------------------------------------------

export const AVATAR_RESOLUTIONS: AvatarResolution[] = ['720p', '1080p'];

/**
 * Motores de generación. p_video_avatar trae TTS (texto o audio); omni_human es
 * más realista pero NO hace TTS → solo disponible cuando hay audio propio.
 */
export const AVATAR_MODELS: {
  id: 'p_video_avatar' | 'omni_human';
  label: string;
  desc: string;
  requiresAudio: boolean;
}[] = [
  {
    id: 'p_video_avatar',
    label: 'Estándar (TTS)',
    desc: 'Voz IA desde texto o audio. Rápido y económico.',
    requiresAudio: false,
  },
  {
    id: 'omni_human',
    label: 'Realista (OmniHuman)',
    desc: 'Mucho más realista. Requiere audio propio (no genera voz desde texto).',
    requiresAudio: true,
  },
];

/** Las 30 voces TTS soportadas, con su género para agrupar en la UI. */
export const AVATAR_VOICES: { id: string; gender: 'female' | 'male' }[] = [
  { id: 'Zephyr (Female)', gender: 'female' },
  { id: 'Puck (Male)', gender: 'male' },
  { id: 'Charon (Male)', gender: 'male' },
  { id: 'Kore (Female)', gender: 'female' },
  { id: 'Fenrir (Male)', gender: 'male' },
  { id: 'Leda (Female)', gender: 'female' },
  { id: 'Orus (Male)', gender: 'male' },
  { id: 'Aoede (Female)', gender: 'female' },
  { id: 'Callirrhoe (Female)', gender: 'female' },
  { id: 'Autonoe (Female)', gender: 'female' },
  { id: 'Enceladus (Male)', gender: 'male' },
  { id: 'Iapetus (Male)', gender: 'male' },
  { id: 'Umbriel (Male)', gender: 'male' },
  { id: 'Algenib (Male)', gender: 'male' },
  { id: 'Despina (Female)', gender: 'female' },
  { id: 'Erinome (Female)', gender: 'female' },
  { id: 'Laomedeia (Female)', gender: 'female' },
  { id: 'Achernar (Female)', gender: 'female' },
  { id: 'Algieba (Male)', gender: 'male' },
  { id: 'Schedar (Male)', gender: 'male' },
  { id: 'Gacrux (Female)', gender: 'female' },
  { id: 'Pulcherrima (Female)', gender: 'female' },
  { id: 'Achird (Male)', gender: 'male' },
  { id: 'Zubenelgenubi (Male)', gender: 'male' },
  { id: 'Vindemiatrix (Female)', gender: 'female' },
  { id: 'Sadachbia (Male)', gender: 'male' },
  { id: 'Sadaltager (Male)', gender: 'male' },
  { id: 'Sulafat (Female)', gender: 'female' },
  { id: 'Alnilam (Male)', gender: 'male' },
  { id: 'Rasalgethi (Male)', gender: 'male' },
];

export const AVATAR_LANGUAGES: string[] = [
  'English (US)',
  'English (UK)',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese (Brazil)',
  'Japanese',
  'Korean',
  'Hindi',
];

// --- Defaults (coinciden con los defaults del schema de Replicate) ----------

export const AVATAR_DEFAULTS = {
  resolution: '720p' as AvatarResolution,
  voiceMode: 'tts' as AvatarVoiceMode,
  voice: 'Zephyr (Female)',
  voiceLanguage: 'English (US)',
  voicePrompt: 'Say the following.',
  videoPrompt: 'The person is talking.',
  disableSafetyFilter: true,
  disablePromptUpsampling: false,
};

/** Ejemplos de guion para poblar el textarea con un clic. */
export const SCRIPT_EXAMPLES: { label: string; text: string }[] = [
  {
    label: 'Bienvenida de marca',
    text: "Hey, welcome to Tim Koda. We turn raw ideas into scroll-stopping content — fast, bold, and unmistakably yours.",
  },
  {
    label: 'Lanzamiento de producto',
    text: "Big news: our new creative engine is live. Drop one image, get a full campaign. Link in bio.",
  },
  {
    label: 'Tip rápido',
    text: "Quick tip: shoot in natural light, keep the camera slightly off-center, and let the texture stay real.",
  },
];

/** Límites del uploader de imágenes del avatar. */
export const AVATAR_IMAGE_LIMITS = {
  /** Tamaño máximo del archivo de entrada. */
  maxBytes: 12 * 1024 * 1024,
  /** Lado más largo tras el resize cliente, en px. */
  maxSidePx: 1280,
  /** Máximo de imágenes candidatas en la galería (la API usa solo 1). */
  maxCandidates: 6,
  supportedMimes: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Límites del uploader de audio. */
export const AVATAR_AUDIO_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  supportedMimes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac'],
};

/** Longitud de guion a partir de la cual avisamos que el video será largo. */
export const SCRIPT_SOFT_LIMIT = 600;

// --- Validación -------------------------------------------------------------

export interface AvatarValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Valida que un request de avatar esté completo antes de enviarlo.
 * No lanza: devuelve la lista de problemas para mostrarlos en la UI.
 */
export function validateAvatarRequest(
  req: Partial<AvatarGenerationRequest> & { voiceMode: AvatarVoiceMode }
): AvatarValidation {
  const errors: string[] = [];

  if (!req.image) {
    errors.push('Selecciona una imagen para el avatar.');
  }
  if (req.voiceMode === 'tts') {
    if (!req.voiceScript || req.voiceScript.trim().length === 0) {
      errors.push('Escribe el guion que dirá el avatar.');
    }
  } else if (req.voiceMode === 'audio') {
    if (!req.audio) {
      errors.push('Sube un archivo de audio para el avatar.');
    }
  }
  if (req.seed !== null && req.seed !== undefined) {
    if (!Number.isInteger(req.seed) || req.seed < 0) {
      errors.push('La semilla debe ser un número entero positivo.');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
