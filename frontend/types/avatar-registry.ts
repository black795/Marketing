/**
 * Registro de Avatares — memoria de personajes por marca.
 *
 * Idea: una Marca tiene uno o más Avatares (personajes). Cada Avatar guarda su
 * IDENTIDAD completa (cara, voz, comportamiento, persona). Al generar un video
 * eliges Marca → Avatar y todo se autocompleta → "cada video con ese avatar".
 *
 * Este es el CIMIENTO (Fase 1). Los campos `referenceImages` y `loraModelId`
 * existen ya aunque hoy no se usen: son el gancho de la Fase 2 (consistencia por
 * referencia) y la Fase 3 (LoRA por personaje + loop de mejora). No se llenan
 * todavía, pero el shape no tendrá que cambiar cuando lleguen.
 *
 * Vive aparte de types/avatar.ts (que es el request puntual a la API) para no
 * mezclar "identidad persistida" con "petición de una generación".
 */
import type { AvatarResolution } from './avatar';

/** Identidad reutilizable de un personaje: lo que lo hace SER ese avatar. */
export interface AvatarIdentity {
  // --- Visual ---
  /** Retrato principal (ruta estática persistida, ej. /assets/output/avatars/...). */
  primaryImageUrl: string;
  /**
   * Imágenes de referencia adicionales. Fase 2/3: crecen con el loop de feedback
   * (cada video aprobado aporta frames) y alimentan la consistencia / el LoRA.
   */
  referenceImages: string[];
  /** Fase 3: id del LoRA entrenado para este personaje. null hasta que exista. */
  loraModelId: string | null;

  // --- Voz ---
  voice: string;
  voiceLanguage: string;
  voicePrompt: string;

  // --- Comportamiento / render ---
  videoPrompt: string;
  resolution: AvatarResolution;
  seed: number | null;
  /**
   * Modelo de generación objetivo para este avatar. null = usar el default del
   * sistema. Reservado para cuando se cablee el modelo de gama media/alta.
   */
  modelId: string | null;

  // --- Persona ---
  /** Character DNA en texto libre: personalidad, tono, do/don't. */
  personaNotes: string;
}

/** Un personaje guardado, perteneciente a una marca. */
export interface Avatar {
  id: string;
  brandId: string;
  name: string;
  identity: AvatarIdentity;
  createdAt: string;
  updatedAt: string;
  /** Telemetría ligera para ranking/UX y para el loop de mejora futuro. */
  stats: {
    generations: number;
    lastUsedAt: string | null;
  };
}

/** Una marca/empresa que agrupa avatares. */
export interface Brand {
  id: string;
  name: string;
  createdAt: string;
}

/** Documento completo del registro (un solo archivo JSON). */
export interface AvatarRegistry {
  version: 1;
  brands: Brand[];
  avatars: Avatar[];
  updatedAt: string;
}

/** Valores por defecto de una identidad nueva (alineados con AVATAR_DEFAULTS). */
export const DEFAULT_IDENTITY: Omit<AvatarIdentity, 'primaryImageUrl'> = {
  referenceImages: [],
  loraModelId: null,
  voice: 'Zephyr (Female)',
  voiceLanguage: 'English (US)',
  voicePrompt: 'Say the following.',
  videoPrompt:
    'The person is talking, subtle natural head movement, natural blinking, slight body sway, breathing.',
  resolution: '720p',
  seed: null,
  modelId: null,
  personaNotes: '',
};
