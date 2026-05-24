/**
 * Tim Koda — Smart Timeline.
 *
 * Vista profesional tipo Premiere/CapCut sobre el mismo `TimelineProject` que
 * usa el Storyboard. NO tiene su propio store de proyecto — comparte el
 * StoryboardProvider. Sólo añade UI state propio (zoom, playhead, tool,
 * selection) via `TimelineUiProvider`.
 *
 *   <StoryboardProvider initialProject={project}>
 *     <TimelineUiProvider>
 *       <TimelinePanel />
 *     </TimelineUiProvider>
 *   </StoryboardProvider>
 */

// Components
export { default as TimelinePanel } from './components/TimelinePanel';
export { default as TimelineToolbar } from './components/TimelineToolbar';
export { default as TimeRuler } from './components/TimeRuler';
export { default as Playhead } from './components/Playhead';
export { default as Waveform } from './components/Waveform';
export { default as TimelineAiActions } from './components/TimelineAiActions';

// Tracks
export { default as VideoTrack } from './tracks/VideoTrack';
export { default as AudioTrack } from './tracks/AudioTrack';
export { default as CaptionTrack } from './tracks/CaptionTrack';
export { default as OverlayTrack } from './tracks/OverlayTrack';
export { default as EffectsTrack } from './tracks/EffectsTrack';
export { default as ClipBlock } from './tracks/ClipBlock';
export { default as TrackHeader } from './tracks/TrackHeader';
export { default as TrackRow } from './tracks/TrackRow';

// Store
export { TimelineUiProvider, useTimelineUi } from './store/context';
export type { TimelineUiAction } from './store/actions';

// Hooks
export { useTimelineLayout } from './hooks/useTimelineLayout';
export { useScrubbing } from './hooks/useScrubbing';
export { useZoom } from './hooks/useZoom';
export { useClipDrag } from './hooks/useClipDrag';
export { useTimelineKeys } from './hooks/useTimelineKeys';

// Types
export type {
  TimelineTool,
  ToolMeta,
  TimelineUiState,
  TimelineTrackKind,
  TrackMeta,
  DragGesture,
} from './types';
export { TOOLS, TRACK_METAS, defaultUiState } from './types';

// Utils
export { framesToPx, pxToFrames, ZOOM_LEVELS, MIN_CLIP_PX } from './utils/pixels';
export { findSnap } from './utils/snap';
export { visibleFrameRange, isInRange } from './utils/virtualization';
