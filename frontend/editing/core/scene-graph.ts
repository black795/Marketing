/**
 * Operaciones sobre el scene graph — todas inmutables.
 *
 * Cada operación devuelve una nueva lista de escenas con los `startFrame` /
 * `endFrame` recalculados en función del orden actual. El sceneNumber se
 * preserva (es el ancla histórica para regen y captions).
 *
 * Las funciones no asumen UI: pueden invocarse desde hooks de React, tests
 * unitarios o (en el futuro) desde una capa servidora que aplique edits.
 */
import type { Scene } from '../types/scene';
import { sumDurationFrames } from '../utils/time';

/** Recalcula `startFrame` / `endFrame` en función del orden actual. */
export function recalcFrames(scenes: Scene[]): Scene[] {
  let cursor = 0;
  return scenes.map((s) => {
    const startFrame = cursor;
    const endFrame = cursor + s.durationFrames;
    cursor = endFrame;
    return { ...s, startFrame, endFrame };
  });
}

export function findSceneById(scenes: Scene[], id: string): Scene | null {
  return scenes.find((s) => s.id === id) ?? null;
}

export function findSceneByNumber(scenes: Scene[], n: number): Scene | null {
  return scenes.find((s) => s.sceneNumber === n) ?? null;
}

/** Aplica un patch a una escena y recalcula frames. */
export function updateScene(
  scenes: Scene[],
  id: string,
  patch: Partial<Scene>
): Scene[] {
  const next = scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
  return recalcFrames(next);
}

/** Mueve una escena a un nuevo índice (drag & drop). */
export function moveScene(scenes: Scene[], id: string, toIndex: number): Scene[] {
  const from = scenes.findIndex((s) => s.id === id);
  if (from === -1) return scenes;
  const clamped = Math.max(0, Math.min(toIndex, scenes.length - 1));
  if (clamped === from) return scenes;
  const next = scenes.slice();
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return recalcFrames(next);
}

/** Inserta una escena en `index` (default = al final). */
export function insertScene(scenes: Scene[], scene: Scene, index?: number): Scene[] {
  const next = scenes.slice();
  const at = index === undefined ? next.length : Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, scene);
  return recalcFrames(next);
}

export function removeScene(scenes: Scene[], id: string): Scene[] {
  const next = scenes.filter((s) => s.id !== id);
  return recalcFrames(next);
}

/** Duplica una escena (nuevo id, nuevo sceneNumber = max+1). */
export function duplicateScene(scenes: Scene[], id: string, mkId: () => string): Scene[] {
  const src = findSceneById(scenes, id);
  if (!src) return scenes;
  const maxN = scenes.reduce((m, s) => Math.max(m, s.sceneNumber), 0);
  const clone: Scene = {
    ...src,
    id: mkId(),
    sceneNumber: maxN + 1,
    name: `${src.name} (copia)`,
    versions: [], // el clon arranca con historial limpio
  };
  const idx = scenes.findIndex((s) => s.id === id);
  return insertScene(scenes, clone, idx + 1);
}

/** true cuando todas las escenas tienen al menos un asset reproducible. */
export function isProjectRenderable(scenes: Scene[]): boolean {
  return scenes
    .filter((s) => s.included)
    .every((s) => s.assets.some((a) => (a.kind === 'video' || a.kind === 'image') && a.src));
}

/** Duración total considerando sólo escenas incluidas. */
export function totalDurationFrames(scenes: Scene[]): number {
  return sumDurationFrames(scenes.filter((s) => s.included));
}

/** Toggle `included` (excluir del render). */
export function toggleIncluded(scenes: Scene[], id: string): Scene[] {
  return updateScene(scenes, id, {
    included: !(findSceneById(scenes, id)?.included ?? true),
  });
}
