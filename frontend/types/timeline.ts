/**
 * Tipos del timeline compartido (`timeline.json`).
 * Espejo del esquema que genera el backend en services/timeline.ts.
 * Lo consumen tanto el editor Remotion como el editor Captions.
 */

export interface TimelineWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface TimelineCaption {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  words: TimelineWord[];
  style: string;
}

export interface TimelineClip {
  id: string;
  sceneNumber: number;
  kind: 'image' | 'video';
  src: string | null;
  startFrame: number;
  durationFrames: number;
  transitionIn: string;
  effects: string[];
}

export interface TimelineAudio {
  src: string;
  startFrame: number;
}

export interface TimelineDocument {
  version: 1;
  projectId: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationFrames: number;
  clips: TimelineClip[];
  captions: TimelineCaption[];
  audio: TimelineAudio | null;
  metadata: {
    createdAt: string;
    sceneCount: number;
    source: 'scripts' | 'avatar' | 'manual';
  };
}
