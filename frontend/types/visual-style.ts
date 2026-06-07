/**
 * Biblioteca de Estilos Visuales.
 *
 * Un estilo se captura desde un carrusel terminado (descripción + prompts
 * representativos + referencias + thumbnail) y se persiste en el backend
 * (mismo patrón que Perfiles / Avatar Registry). Después se selecciona en la
 * config del carrusel para que el motor lo IMITE: su descripción y prompts se
 * inyectan en el prompt, y sus referencias se precargan.
 */
import type { CarouselReferenceKind } from './carousel';

export interface VisualStyleReference {
  id: string;
  tipo: CarouselReferenceKind;
  /** URL servida por el backend (o data URL). Usable en <img> y por el worker. */
  url: string;
  nombre?: string;
}

export interface VisualStyle {
  id: string;
  name: string;
  /** Descripción del look (paleta, luz, textura, tono). */
  styleNote: string;
  /** Prompts representativos de slides del carrusel de origen (few-shot). */
  samplePrompts: string[];
  /** Referencias visuales guardadas con el estilo (branding, logo, ejemplos). */
  references: VisualStyleReference[];
  /** Imagen de muestra para la tarjeta. */
  thumbnailUrl: string | null;
  /** Config de origen, informativo. */
  source?: { platform?: string; type?: string; objective?: string };
  stats: { uses: number; lastUsedAt: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface VisualStyleRegistry {
  version: 1;
  styles: VisualStyle[];
  updatedAt: string;
}

/**
 * Bloque de contexto que se inyecta en el motor de prompts para imitar el
 * estilo. Mismo espíritu que buildProfileContext.
 */
export function buildStyleContext(style: VisualStyle, maxPrompts = 3): string {
  const lines: string[] = [];
  lines.push(
    `Estilo visual a IMITAR (OBLIGATORIO): "${style.name}". ${style.styleNote.trim()}`.trim(),
  );
  const prompts = style.samplePrompts.filter(Boolean).slice(0, maxPrompts);
  if (prompts.length > 0) {
    lines.push(
      'Prompts de referencia de ese estilo (imitá su look, encuadre y tratamiento; NO los copies literal):',
    );
    prompts.forEach((p, i) => lines.push(`  ${i + 1}. ${p.trim().slice(0, 400)}`));
  }
  if (style.references.length > 0) {
    lines.push(
      `El estilo trae ${style.references.length} referencia(s) visual(es) ya cargada(s) como input para el modelo de imagen.`,
    );
  }
  return lines.join('\n');
}
