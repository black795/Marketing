/**
 * Catálogo y adapters de editores — alimenta el "Editor Picker" del Hub.
 *
 * Cada editor expone metadatos (para el card) y un `buildOpenHref` que
 * arma la URL de apertura con el contexto del proyecto. Agregar un editor
 * nuevo = añadirlo a `EDITORS`: nada más cambia.
 */
import type { EditPlan } from '@/types/edit-plan';

export interface EditorCapabilities {
  captions: boolean;
  audio: boolean;
  transitions: boolean;
  customLayout: boolean;
}

export interface EditorAdapterInfo {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** false = registrado pero su pipeline aún no está implementado. */
  implemented: boolean;
  /** Etiqueta visible (Recomendado / Próximamente / …). */
  badge?: string;
  capabilities: EditorCapabilities;
}

export interface EditorAdapter {
  info: EditorAdapterInfo;
  /** URL para abrir el editor con el contexto del proyecto. */
  buildOpenHref(plan: EditPlan): string;
}

const remotion: EditorAdapter = {
  info: {
    id: 'remotion',
    label: 'Remotion',
    emoji: '🎬',
    description:
      'Montaje y render programático en React. Composición precisa fps a fps.',
    implemented: true,
    capabilities: { captions: false, audio: true, transitions: true, customLayout: true },
  },
  buildOpenHref(plan) {
    return `/editor/remotion?projectId=${encodeURIComponent(plan.projectId)}`;
  },
};

const captions: EditorAdapter = {
  info: {
    id: 'captions',
    label: 'Captions',
    emoji: '✨',
    description:
      'Subtítulos dinámicos estilo redes sociales — karaoke, word highlight, viral.',
    implemented: true,
    badge: 'Recomendado',
    capabilities: { captions: true, audio: false, transitions: false, customLayout: false },
  },
  buildOpenHref(plan) {
    return `/editor/captions?projectId=${encodeURIComponent(plan.projectId)}`;
  },
};

/** Genera un stub honesto: muestra el card pero deja claro que no está listo. */
function makeStubEditor(
  info: Omit<EditorAdapterInfo, 'implemented' | 'badge'>
): EditorAdapter {
  const full: EditorAdapterInfo = {
    ...info,
    implemented: false,
    badge: 'Próximamente',
  };
  return {
    info: full,
    buildOpenHref(plan) {
      // No debería invocarse — el Hub deshabilita los stubs.
      return `/editor?projectId=${encodeURIComponent(plan.projectId)}`;
    },
  };
}

const internal = makeStubEditor({
  id: 'internal',
  label: 'Editor interno',
  emoji: '🧩',
  description: 'Editor visual drag & drop sobre el timeline del proyecto.',
  capabilities: { captions: true, audio: true, transitions: true, customLayout: true },
});

const apiExternal = makeStubEditor({
  id: 'api',
  label: 'API externa',
  emoji: '🔌',
  description: 'Conector genérico a APIs de edición de terceros (key + endpoint).',
  capabilities: { captions: true, audio: true, transitions: true, customLayout: false },
});

const aiTimeline = makeStubEditor({
  id: 'ai-timeline',
  label: 'Timeline IA automática',
  emoji: '🤖',
  description: 'IA decide cortes, ritmo y transiciones a partir del prompt.',
  capabilities: { captions: true, audio: true, transitions: true, customLayout: false },
});

const webVisual = makeStubEditor({
  id: 'web-visual',
  label: 'Editor web visual',
  emoji: '🖥️',
  description: 'Mini-DAW en navegador con preview en tiempo real.',
  capabilities: { captions: true, audio: true, transitions: true, customLayout: true },
});

export const EDITORS: EditorAdapter[] = [
  captions,
  remotion,
  internal,
  apiExternal,
  aiTimeline,
  webVisual,
];

export function getEditor(id: string): EditorAdapter | undefined {
  return EDITORS.find((e) => e.info.id === id);
}
