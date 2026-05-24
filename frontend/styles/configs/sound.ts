/**
 * SoundBehavior — extras de audio que el SFX engine no cubre.
 *
 * - voiceDucking      reducción del volumen del voiceover cuando suena un SFX.
 * - musicVolume       volumen de la música de fondo (0..1).
 * - hookRiser         si añadir un riser antes de la primera escena 'hook'.
 * - sfxPresetId       reusa el catálogo del Auto Editing Engine.
 */
export interface SoundBehavior {
  sfxPresetId: 'off' | 'minimal' | 'viral' | 'maximalist';
  voiceDucking: number;
  musicVolume: number;
  hookRiser: boolean;
}
