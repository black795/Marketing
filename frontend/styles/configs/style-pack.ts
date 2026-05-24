/**
 * StylePack — la identidad visual completa de un estilo.
 *
 * Es un superset del `AutoEditConfig` del Auto Editing Engine + 4 packs nuevos:
 * colorGrade, animations, overlays, sound, effects. El processor consume un
 * StylePack y reescribe el proyecto coherentemente.
 *
 * El shape es 100% data — añadir un estilo = exportar un objeto que cumple
 * esta interfaz desde `presets/<id>.ts` y añadirlo al barrel.
 */
import type { AutoEditConfig } from '@/editing/engine';
import type { ColorGrade } from './color-grade';
import type { AnimationPack } from './animations';
import type { OverlayTemplate } from './overlays';
import type { SoundBehavior } from './sound';

/** Efecto a aplicar a todas las escenas (grain, glitch, RGB split, …). */
export interface SceneWideEffect {
  kind: string;
  params: Record<string, unknown>;
}

export interface StylePack {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Términos que el prompt-to-style usa para emparejar lenguaje natural. */
  tags: string[];
  /** Base: lo que el Auto Editing Engine ya sabe hacer. */
  autoEdit: AutoEditConfig;
  /** Extras del Style Engine. */
  colorGrade: ColorGrade;
  animations: AnimationPack;
  /** Overlays inyectados según el rol de cada escena. */
  overlays: OverlayTemplate[];
  sound: SoundBehavior;
  /** Efectos scene-wide aplicados a TODAS las escenas. */
  effects: SceneWideEffect[];
}
