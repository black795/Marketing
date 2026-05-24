/**
 * Helpers de drag & drop nativo HTML5.
 *
 * El payload va por `dataTransfer` con un tipo custom + el sceneId. Devuelve
 * funciones listas para conectar en los eventos de las cards y del contenedor.
 */

export const SCENE_DRAG_TYPE = 'application/x-tim-koda-scene';

export function readSceneId(dataTransfer: DataTransfer | null): string | null {
  if (!dataTransfer) return null;
  const id = dataTransfer.getData(SCENE_DRAG_TYPE);
  return id || null;
}

export function writeSceneId(dataTransfer: DataTransfer, sceneId: string): void {
  dataTransfer.setData(SCENE_DRAG_TYPE, sceneId);
  dataTransfer.effectAllowed = 'move';
}
