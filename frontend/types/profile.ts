/**
 * Perfil / Dominio de uso — memoria de contexto por rubro.
 *
 * Un Perfil (ej. "Agente Inmobiliario") captura el contexto de un dominio para
 * SESGAR la generación de guiones hacia ese rubro. Acumula 4 cosas (todas
 * opt-in, nada automático):
 *   1. Contexto del dominio (systemContext + tono + do/don't)
 *   2. Ejemplos aprobados (prompts/guiones que funcionaron) — few-shot
 *   3. Avatares vinculados (del Avatar Registry)
 *   4. Referencias visuales del rubro
 *
 * El Perfil es el "paraguas": eliges Perfil → su contexto entra en el prompt y
 * sus avatares/refs quedan a mano.
 */

export type ProfileExampleKind = 'prompt' | 'script';

export interface ProfileExample {
  id: string;
  kind: ProfileExampleKind;
  text: string;
  addedAt: string;
}

export interface Profile {
  id: string;
  name: string;
  /** Etiqueta corta del rubro, ej. "real estate", "fitness". */
  domain: string;
  /** Contexto que se inyecta en el prompt (quién, para quién, objetivo). */
  systemContext: string;
  tone: string;
  /** Qué hacer (buenas prácticas del rubro). */
  dos: string;
  /** Qué evitar. */
  donts: string;
  /** Avatares vinculados (ids del Avatar Registry). */
  avatarIds: string[];
  /** Ejemplos aprobados (few-shot). Crece solo cuando el usuario lo decide. */
  examples: ProfileExample[];
  /** Referencias visuales del rubro (rutas estáticas persistidas). */
  referenceImages: string[];
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRegistry {
  version: 1;
  profiles: Profile[];
  updatedAt: string;
}

export const DEFAULT_PROFILE: Omit<Profile, 'id' | 'name' | 'createdAt' | 'updatedAt'> = {
  domain: '',
  systemContext: '',
  tone: '',
  dos: '',
  donts: '',
  avatarIds: [],
  examples: [],
  referenceImages: [],
  stats: { uses: 0, lastUsedAt: null },
};

/**
 * Construye el bloque de contexto que se inyecta en generate-script.
 * Solo incluye lo que tenga contenido. Limita ejemplos para controlar tokens.
 */
export function buildProfileContext(profile: Profile, maxExamples = 4): string {
  const lines: string[] = [];
  lines.push(
    `Contexto de dominio (OBLIGATORIO seguir): este contenido es para el perfil "${profile.name}"${
      profile.domain ? ` — rubro: ${profile.domain}` : ''
    }.`
  );
  if (profile.systemContext.trim()) lines.push(`Quién/objetivo: ${profile.systemContext.trim()}`);
  if (profile.tone.trim()) lines.push(`Tono: ${profile.tone.trim()}`);
  if (profile.dos.trim()) lines.push(`Hacer: ${profile.dos.trim()}`);
  if (profile.donts.trim()) lines.push(`Evitar: ${profile.donts.trim()}`);

  const examples = profile.examples.slice(-maxExamples);
  if (examples.length > 0) {
    lines.push(
      'Ejemplos aprobados para este dominio (úsalos como referencia de estilo y enfoque, NO los copies literal):'
    );
    examples.forEach((ex, i) => {
      lines.push(`  ${i + 1}. [${ex.kind}] ${ex.text.trim().slice(0, 400)}`);
    });
  }
  return lines.join('\n');
}
