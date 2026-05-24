export type {
  CaptionStyle,
  CaptionFont,
  CaptionColors,
  CaptionLayout,
  CaptionHighlight,
  HighlightMode,
} from './styles';
export { CAPTION_STYLES, getCaptionStyle } from './styles';
export type { EmojiRule } from './emoji';
export { DEFAULT_EMOJI_MAP, suggestEmoji } from './emoji';
export { detectEmphasis } from './emphasis';
export type { CaptionProcessOptions } from './process';
export { applyCaptionStyle } from './process';
