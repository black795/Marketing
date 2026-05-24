/** Generadores de IDs para el scene graph. */

function rand(): string {
  // 6 chars base36 son suficientes para el dominio (decenas de escenas).
  return Math.random().toString(36).slice(2, 8);
}

export function newSceneId(sceneNumber?: number): string {
  return sceneNumber !== undefined
    ? `scene-${String(sceneNumber).padStart(2, '0')}-${rand()}`
    : `scene-${rand()}`;
}

export function newAssetId(kind: string): string {
  return `asset-${kind}-${rand()}`;
}

export function newOverlayId(): string {
  return `ov-${rand()}`;
}

export function newCaptionId(sceneNumber?: number): string {
  return sceneNumber !== undefined
    ? `cap-${String(sceneNumber).padStart(2, '0')}-${rand()}`
    : `cap-${rand()}`;
}

export function newAudioTrackId(kind: string): string {
  return `audio-${kind}-${rand()}`;
}

export function newEffectId(kind: string): string {
  return `fx-${kind}-${rand()}`;
}

export function newVersionId(): string {
  return `v-${Date.now()}-${rand()}`;
}
