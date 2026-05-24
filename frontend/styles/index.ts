/**
 * Tim Koda — Style Engine.
 *
 *   import { applyStylePack, STYLE_PACKS, StylesPanel } from '@/styles';
 *
 * Capa de alto nivel sobre el Auto Editing Engine. Cada StylePack añade
 * colorGrade, animations, overlays templated, sound behavior y scene-wide
 * effects a la config base (captions/camera/timing/sfx/transitions/emotion).
 *
 * Subcarpetas:
 *   configs/   tipos (ColorGrade, AnimationPack, OverlayTemplate, SoundBehavior, StylePack)
 *   presets/   8 packs: TikTok / Hormozi / MrBeast / Podcast / Documentary / Gaming / Luxury / Anime
 *   engines/   processor + helpers (color-grade-applier, animation-applier, overlay-injector)
 *   utils/     prompt-to-style mapping + live-preview snapshot
 *   components/ UI (StylesPanel, StyleSwitcher, StyleLivePreview, StylePromptInput, StylePackCard)
 */

// Configs (types)
export type {
  StylePack,
  SceneWideEffect,
  ColorGrade,
  AnimationPack,
  CaptionAnimation,
  CaptionEntry,
  CaptionExit,
  CaptionPerWord,
  ClipEntry,
  OverlayTemplate,
  OverlayKind,
  OverlayPosition,
  OverlayAnimation,
  SoundBehavior,
} from './configs';
export { IDENTITY_GRADE, FLAT_ANIMATIONS } from './configs';

// Presets
export {
  STYLE_PACKS,
  getStylePack,
  TIKTOK_VIRAL,
  HORMOZI,
  MRBEAST,
  PODCAST,
  DOCUMENTARY,
  GAMING,
  LUXURY,
  ANIME,
} from './presets';

// Engines
export {
  applyStylePack,
  applyColorGrade,
  applyAnimations,
  injectOverlays,
  type ApplyOptions,
  type ApplyResult,
  type StylePackReport,
} from './engines';

// Utils
export {
  matchStyleFromPrompt,
  buildPreviewSnapshot,
  colorGradeToCss,
  type PromptMatch,
  type PreviewSnapshot,
} from './utils';

// Components
export * from './components';
