/**
 * AnimationPack — animaciones de caption y de clip principal.
 *
 * Se materializan como SceneEffect `{kind:'caption-animation', params}` y
 * `{kind:'clip-animation', params}` para que el render las consuma. No alteran
 * el scene graph estructuralmente — son metadatos visuales.
 */

export type CaptionEntry = 'pop' | 'slide-up' | 'fade' | 'bounce' | 'none';
export type CaptionExit = 'fade' | 'pop-out' | 'slide-down' | 'none';
export type CaptionPerWord = 'color' | 'scale' | 'bounce' | 'none';

export type ClipEntry = 'cut' | 'fade-in' | 'zoom-in' | 'punch-in' | 'slide-left';

export interface CaptionAnimation {
  entry: CaptionEntry;
  exit: CaptionExit;
  perWord: CaptionPerWord;
}

export interface AnimationPack {
  captions: CaptionAnimation;
  clipEntry: ClipEntry;
}

export const FLAT_ANIMATIONS: AnimationPack = {
  captions: { entry: 'fade', exit: 'fade', perWord: 'none' },
  clipEntry: 'cut',
};
