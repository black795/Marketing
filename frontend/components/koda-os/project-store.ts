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
import type { CarouselConfig, Carousel, CarouselReferences } from '@/types/carousel';
import { DEFAULT_CAROUSEL_CONFIG, EMPTY_CAROUSEL_REFERENCES } from '@/types/carousel';

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
  /** Perfil/dominio seleccionado en /scripts (para sesgar guion y acumular ejemplos). */
  profileId: string | null;
  /** Preset de estética (Realista/Cartoon/…) aplicado al guion. */
  scriptAestheticId: string | null;
  /** Estilo visual guardado (biblioteca) aplicado al guion. */
  scriptStyleId: string | null;
  /** Guiones favoritos seleccionados como few-shot para la próxima generación. */
  favoriteScriptIds: string[];
  /** Configuración de la fase Carousel Generator (entre storyboard y styles). */
  carouselConfig: CarouselConfig;
  /** Referencias visuales del carrusel (producto + secundarias para GPT Image 2). */
  carouselReferences: CarouselReferences;
  /** Carruseles con sus prompts generados (null hasta generar). */
  carousels: Carousel[] | null;
  /** True cuando el usuario aprobó los prompts de los carruseles. */
  carouselPromptsApproved: boolean;
  /** Firma de los inputs con los que se generaron los prompts (cache). */
  carouselPromptsSig: string | null;
  /** Estilo visual guardado aplicado al carrusel (id de la biblioteca). */
  carouselStyleId: string | null;
  /** Id del carrusel elegido para generar imágenes (solo se genera ése). */
  carouselSelectedId: string | null;
  /** Id del proyecto guardado en el backend (para sobrescribir al re-guardar). */
  savedProjectId: string | null;
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
  profileId: null,
  scriptAestheticId: null,
  scriptStyleId: null,
  favoriteScriptIds: [],
  carouselConfig: DEFAULT_CAROUSEL_CONFIG,
  carouselReferences: EMPTY_CAROUSEL_REFERENCES,
  carousels: null,
  carouselPromptsApproved: false,
  carouselPromptsSig: null,
  carouselStyleId: null,
  carouselSelectedId: null,
  savedProjectId: null,
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

  setProfileId(profileId: string | null): void {
    hydrate();
    memoryState = { ...memoryState, profileId };
    persist();
    emit();
  },

  /** Actualiza (merge parcial) la config de la fase Carousel Generator. */
  setCarouselConfig(partial: Partial<CarouselConfig>): void {
    hydrate();
    memoryState = {
      ...memoryState,
      carouselConfig: { ...memoryState.carouselConfig, ...partial },
    };
    persist();
    emit();
  },

  setCarousels(carousels: Carousel[] | null): void {
    hydrate();
    memoryState = { ...memoryState, carousels };
    persist();
    emit();
  },

  /** Fija el set de carruseles + la firma con la que se generaron (cache). */
  setCarouselPrompts(carousels: Carousel[], sig: string): void {
    hydrate();
    memoryState = {
      ...memoryState,
      carousels,
      carouselPromptsSig: sig,
      carouselPromptsApproved: false,
      carouselSelectedId: null,
    };
    persist();
    emit();
  },

  /** Reemplaza un carrusel por id (regeneración completa). Desaprueba. */
  replaceCarousel(carousel: Carousel): void {
    hydrate();
    const current = memoryState.carousels ?? [];
    const idx = current.findIndex((c) => c.id === carousel.id);
    const carousels = idx < 0 ? [...current, carousel] : current.map((c, i) => (i === idx ? carousel : c));
    memoryState = { ...memoryState, carousels, carouselPromptsApproved: false };
    persist();
    emit();
  },

  /** Aplica un patch a una slide concreta. Desaprueba. */
  updateCarouselSlide(carouselId: string, slideIndex: number, patch: Partial<Carousel['slides'][number]>): void {
    hydrate();
    const current = memoryState.carousels;
    if (!current) return;
    memoryState = {
      ...memoryState,
      carousels: current.map((c) =>
        c.id === carouselId
          ? { ...c, slides: c.slides.map((s) => (s.index === slideIndex ? { ...s, ...patch } : s)) }
          : c,
      ),
      carouselPromptsApproved: false,
    };
    persist();
    emit();
  },

  /**
   * Actualiza los campos de IMAGEN de una slide (imageUrl/imageError/imageMeta)
   * sin tocar la aprobación de prompts — generar imágenes no desaprueba.
   */
  setCarouselSlideImage(
    carouselId: string,
    slideIndex: number,
    patch: Pick<Carousel['slides'][number], 'imageUrl' | 'imageError' | 'imageMeta'>,
  ): void {
    hydrate();
    const current = memoryState.carousels;
    if (!current) return;
    memoryState = {
      ...memoryState,
      carousels: current.map((c) =>
        c.id === carouselId
          ? {
              ...c,
              slides: c.slides.map((s) =>
                s.index === slideIndex
                  ? { ...s, imageUrl: patch.imageUrl, imageError: patch.imageError, imageMeta: patch.imageMeta }
                  : s,
              ),
            }
          : c,
      ),
    };
    persist();
    emit();
  },

  /**
   * Reordena las slides de un carrusel (posiciones 0-based) y reasigna index
   * 1..N. Cada slide conserva su imagen/metadatos al moverse. No desaprueba.
   */
  reorderCarouselSlides(carouselId: string, from: number, to: number): void {
    hydrate();
    const current = memoryState.carousels;
    if (!current) return;
    memoryState = {
      ...memoryState,
      carousels: current.map((c) => {
        if (c.id !== carouselId) return c;
        const slides = [...c.slides];
        if (from < 0 || to < 0 || from >= slides.length || to >= slides.length || from === to) {
          return c;
        }
        const [moved] = slides.splice(from, 1);
        slides.splice(to, 0, moved);
        return { ...c, slides: slides.map((s, i) => ({ ...s, index: i + 1 })) };
      }),
    };
    persist();
    emit();
  },

  /** Marca qué carrusel se llevará a la generación de imágenes (solo ése). */
  setCarouselSelectedId(carouselSelectedId: string | null): void {
    hydrate();
    memoryState = { ...memoryState, carouselSelectedId };
    persist();
    emit();
  },

  /**
   * Agrega una slide nueva al final de un carrusel y reasigna index 1..N.
   * Desaprueba los prompts (el contenido cambió).
   */
  addCarouselSlide(carouselId: string, slide: Carousel['slides'][number]): void {
    hydrate();
    const current = memoryState.carousels;
    if (!current) return;
    memoryState = {
      ...memoryState,
      carousels: current.map((c) =>
        c.id === carouselId
          ? { ...c, slides: [...c.slides, slide].map((s, i) => ({ ...s, index: i + 1 })) }
          : c,
      ),
      carouselPromptsApproved: false,
    };
    persist();
    emit();
  },

  /**
   * Elimina una slide de un carrusel y reasigna index 1..N. No deja un
   * carrusel sin slides (mínimo 1). Desaprueba los prompts.
   */
  removeCarouselSlide(carouselId: string, slideIndex: number): void {
    hydrate();
    const current = memoryState.carousels;
    if (!current) return;
    memoryState = {
      ...memoryState,
      carousels: current.map((c) => {
        if (c.id !== carouselId) return c;
        if (c.slides.length <= 1) return c;
        const slides = c.slides
          .filter((s) => s.index !== slideIndex)
          .map((s, i) => ({ ...s, index: i + 1 }));
        return { ...c, slides };
      }),
      carouselPromptsApproved: false,
    };
    persist();
    emit();
  },

  approveCarouselPrompts(): void {
    hydrate();
    memoryState = { ...memoryState, carouselPromptsApproved: true };
    persist();
    emit();
  },

  unapproveCarouselPrompts(): void {
    hydrate();
    memoryState = { ...memoryState, carouselPromptsApproved: false };
    persist();
    emit();
  },

  /** Reemplaza el set completo de referencias visuales del carrusel. */
  setCarouselReferences(carouselReferences: CarouselReferences): void {
    hydrate();
    memoryState = { ...memoryState, carouselReferences };
    persist();
    emit();
  },

  /** Estilo visual guardado aplicado al carrusel (o null para limpiar). */
  setCarouselStyleId(carouselStyleId: string | null): void {
    hydrate();
    memoryState = { ...memoryState, carouselStyleId };
    persist();
    emit();
  },

  /** Reemplaza el estado completo con un snapshot guardado (merge con defaults). */
  loadProject(state: Partial<ProjectState>): void {
    hydrate();
    memoryState = {
      ...DEFAULT_STATE,
      ...state,
      form: { ...DEFAULT_FORM, ...(state.form ?? {}) },
    };
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
export type { CarouselConfig, Carousel, CarouselReferences };
export { DEFAULT_SETTINGS, DEFAULT_FORM };
