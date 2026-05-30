'use client';

// Tim Koda OS - project store
// Tiny sessionStorage-backed store shared across all workflow routes.
// No external deps. State persists across route navigations but resets on
// new tab. Each route reads what it needs; writes broadcast to all subscribers.

import { useSyncExternalStore } from 'react';
import type {
  GenerateScriptResponse,
  Scene,
  VideoSceneOutput,
} from '@/types/story';
import type {
  GenerationSettings,
  AspectRatioOption,
  QualityProfile,
} from '@/lib/generation-settings';
import { DEFAULT_SETTINGS } from '@/lib/generation-settings';
import type { SceneVersion } from '@/lib/scene-history';

const STORAGE_KEY = 'koda-os:project';

export type ReferenceImage = {
  id: string;
  /** data: URL — what the backend accepts as `referenceImages[]`. */
  dataUrl: string;
  /** Optional filename for display. */
  name?: string;
  /** Dimensions after canvas resize (when available). */
  width?: number;
  height?: number;
  /** Approx payload size in bytes after resize. */
  bytes?: number;
};

export type PromptForm = {
  visualPrompt: string;
  narrativePrompt: string;
  model: string;
  /** Reference images attached to the prompt (character DNA). */
  references: ReferenceImage[];
  settings: GenerationSettings;
};

export type ProjectState = {
  /** Latest submitted prompt context. */
  form: PromptForm;
  /** Last script returned by Claude. */
  script: GenerateScriptResponse | null;
  /** True when the user explicitly approved the script and moved on. */
  scriptApproved: boolean;
  /** Scenes with image URLs (after Phase 3). Mirrors `script.scenes` shape. */
  scenes: Scene[] | null;
  /** Per-scene version history (key = scene_number). Persists in sessionStorage. */
  sceneHistory: Record<number, SceneVersion[]>;
  /** Scenes with video URLs (after Phase 5). */
  videoScenes: VideoSceneOutput[] | null;
  /** Selected visual style id from /styles. */
  styleId: string | null;
};

const DEFAULT_FORM: PromptForm = {
  visualPrompt: '',
  narrativePrompt: '',
  model: 'nano-banana-pro',
  references: [],
  settings: DEFAULT_SETTINGS,
};

const DEFAULT_STATE: ProjectState = {
  form: DEFAULT_FORM,
  script: null,
  scriptApproved: false,
  scenes: null,
  sceneHistory: {},
  videoScenes: null,
  styleId: null,
};

// ---- internal mutable singleton ----------------------------------------

let memoryState: ProjectState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ProjectState>;
    memoryState = {
      ...DEFAULT_STATE,
      ...parsed,
      form: { ...DEFAULT_FORM, ...(parsed.form ?? {}) },
    };
  } catch {
    // ignore - keep defaults
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    // sessionStorage may be full or disabled; silently ignore
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  hydrate();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot(): ProjectState {
  hydrate();
  return memoryState;
}

function serverSnapshot(): ProjectState {
  return DEFAULT_STATE;
}

// ---- React binding -----------------------------------------------------

export function useProject(): ProjectState {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useProjectSelector<T>(selector: (s: ProjectState) => T): T {
  const state = useProject();
  return selector(state);
}

// ---- imperative API (callable from event handlers, no hooks) -----------

export const projectStore = {
  get: snapshot,

  set(partial: Partial<ProjectState>): void {
    hydrate();
    memoryState = { ...memoryState, ...partial };
    persist();
    emit();
  },

  setForm(partial: Partial<PromptForm>): void {
    hydrate();
    memoryState = {
      ...memoryState,
      form: { ...memoryState.form, ...partial },
    };
    persist();
    emit();
  },

  setSettings(partial: Partial<GenerationSettings>): void {
    hydrate();
    memoryState = {
      ...memoryState,
      form: {
        ...memoryState.form,
        settings: { ...memoryState.form.settings, ...partial },
      },
    };
    persist();
    emit();
  },

  setScript(script: GenerateScriptResponse | null): void {
    hydrate();
    memoryState = {
      ...memoryState,
      script,
      scriptApproved: false,
      // New script invalidates downstream artifacts.
      scenes: null,
      sceneHistory: {},
      videoScenes: null,
    };
    persist();
    emit();
  },

  approveScript(): void {
    hydrate();
    memoryState = { ...memoryState, scriptApproved: true };
    persist();
    emit();
  },

  unapproveScript(): void {
    hydrate();
    memoryState = { ...memoryState, scriptApproved: false };
    persist();
    emit();
  },

  setScenes(scenes: Scene[] | null): void {
    hydrate();
    memoryState = { ...memoryState, scenes };
    persist();
    emit();
  },

  updateScene(scene_number: number, patch: Partial<Scene>): void {
    hydrate();
    const current = memoryState.scenes;
    if (!current) return;
    memoryState = {
      ...memoryState,
      scenes: current.map((s) =>
        s.scene_number === scene_number ? { ...s, ...patch } : s,
      ),
    };
    persist();
    emit();
  },

  /**
   * Reemplaza completo el objeto Scene (igual que el legacy: cada SSE trae
   * la escena entera con todos los campos del backend, no solo el image_url).
   * Si la escena no existe aun, la appendea.
   */
  replaceScene(scene: Scene): void {
    hydrate();
    const current = memoryState.scenes;
    if (!current) {
      memoryState = { ...memoryState, scenes: [scene] };
    } else {
      const idx = current.findIndex((s) => s.scene_number === scene.scene_number);
      const next =
        idx < 0
          ? [...current, scene]
          : current.map((s, i) => (i === idx ? scene : s));
      memoryState = { ...memoryState, scenes: next };
    }
    persist();
    emit();
  },

  /** Appendea una version al historial de la escena. */
  addSceneVersion(scene_number: number, version: SceneVersion): void {
    hydrate();
    const prev = memoryState.sceneHistory[scene_number] ?? [];
    memoryState = {
      ...memoryState,
      sceneHistory: {
        ...memoryState.sceneHistory,
        [scene_number]: [...prev, version],
      },
    };
    persist();
    emit();
  },

  /** Devuelve el historial de una escena (o []). */
  getSceneHistory(scene_number: number): SceneVersion[] {
    hydrate();
    return memoryState.sceneHistory[scene_number] ?? [];
  },

  setVideoScenes(videoScenes: VideoSceneOutput[] | null): void {
    hydrate();
    memoryState = { ...memoryState, videoScenes };
    persist();
    emit();
  },

  setStyleId(styleId: string | null): void {
    hydrate();
    memoryState = { ...memoryState, styleId };
    persist();
    emit();
  },

  reset(): void {
    memoryState = DEFAULT_STATE;
    persist();
    emit();
  },
};

// ---- public helpers ----------------------------------------------------

export type { GenerationSettings, AspectRatioOption, QualityProfile };
export { DEFAULT_SETTINGS, DEFAULT_FORM };
