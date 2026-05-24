/**
 * OverlayTemplate — plantilla de overlay que el processor materializa
 * como `SceneOverlay` añadiéndolo a las escenas del rol indicado.
 *
 * Los renderers (Remotion / ffmpeg drawtext) interpretan el `kind` y el
 * `content` para pintar el overlay. Los presets traen un set predefinido
 * de templates pero el usuario puede añadir las suyas.
 */
import type { SceneRole } from '@/editing';

export type OverlayKind = 'text' | 'sticker' | 'logo' | 'shape' | 'image';

export interface OverlayPosition {
  x: number; // 0..1 relativo al frame
  y: number;
  anchor?: 'tl' | 'tc' | 'tr' | 'cl' | 'center' | 'cr' | 'bl' | 'bc' | 'br';
}

export interface OverlayAnimation {
  enter?: 'pop' | 'slide' | 'fade';
  exit?: 'pop' | 'slide' | 'fade';
}

export interface OverlayTemplate {
  id: string;
  kind: OverlayKind;
  /** Roles donde se inyecta una instancia al inicio de la escena. */
  injectOnRoles: SceneRole[];
  position: OverlayPosition;
  /** Datos específicos del kind (text→{text,color,size,…}; logo→{src}; …). */
  content: Record<string, unknown>;
  /** Duración del overlay en frames. */
  durationFrames: number;
  animation?: OverlayAnimation;
}
