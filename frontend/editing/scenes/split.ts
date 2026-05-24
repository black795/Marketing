/**
 * Split — divide una escena en dos al frame indicado.
 *
 * Reglas:
 *   1. La escena original conserva `id` y `sceneNumber`; su durationFrames se
 *      acorta hasta `atFrame`.
 *   2. La escena nueva recibe un nuevo `id` y `sceneNumber = max+1`; arranca
 *      donde termina la primera y dura el resto.
 *   3. Captions: las que terminan antes del split → primera; las que empiezan
 *      después → segunda; las que cruzan se cortan en dos.
 *   4. Audio tracks: análogo a captions (corte por solapamiento).
 *   5. Overlays/effects/versions: la primera mantiene los suyos; la segunda
 *      hereda overlays/effects pero `versions[]` empieza vacío (es escena nueva).
 *
 * El caller suele aplicar `recalcFrames` después para asegurar coherencia.
 */
import type { Scene, SceneCaption, SceneWord, SceneAudioTrack } from '../types/scene';
import { newCaptionId, newAudioTrackId } from '../utils/ids';

function splitWords(words: SceneWord[], at: number): { left: SceneWord[]; right: SceneWord[] } {
  const left: SceneWord[] = [];
  const right: SceneWord[] = [];
  for (const w of words) {
    if (w.endFrame <= at) left.push(w);
    else if (w.startFrame >= at) right.push(w);
    else {
      // word cruza el corte — la asignamos al lado donde tenga más duración.
      const inLeft = at - w.startFrame;
      const inRight = w.endFrame - at;
      if (inLeft >= inRight) left.push({ ...w, endFrame: at });
      else right.push({ ...w, startFrame: at });
    }
  }
  return { left, right };
}

function splitCaptions(caps: SceneCaption[], at: number, sceneNumber: number): {
  left: SceneCaption[];
  right: SceneCaption[];
} {
  const left: SceneCaption[] = [];
  const right: SceneCaption[] = [];
  for (const c of caps) {
    if (c.endFrame <= at) {
      left.push(c);
    } else if (c.startFrame >= at) {
      right.push(c);
    } else {
      const wordSplit = splitWords(c.words, at);
      if (wordSplit.left.length > 0) {
        left.push({
          ...c,
          endFrame: at,
          words: wordSplit.left,
          text: wordSplit.left.map((w) => w.text).join(' '),
        });
      }
      if (wordSplit.right.length > 0) {
        right.push({
          ...c,
          id: newCaptionId(sceneNumber),
          startFrame: at,
          words: wordSplit.right,
          text: wordSplit.right.map((w) => w.text).join(' '),
        });
      }
    }
  }
  return { left, right };
}

function splitAudio(tracks: SceneAudioTrack[], at: number): {
  left: SceneAudioTrack[];
  right: SceneAudioTrack[];
} {
  const left: SceneAudioTrack[] = [];
  const right: SceneAudioTrack[] = [];
  for (const t of tracks) {
    const end = t.startFrame + t.durationFrames;
    if (end <= at) {
      left.push(t);
    } else if (t.startFrame >= at) {
      right.push(t);
    } else {
      left.push({ ...t, durationFrames: at - t.startFrame });
      right.push({
        ...t,
        id: newAudioTrackId(t.kind),
        startFrame: at,
        durationFrames: end - at,
      });
    }
  }
  return { left, right };
}

export function splitScene(
  scenes: Scene[],
  sceneId: string,
  atFrameAbsolute: number,
  mkSceneId: () => string
): Scene[] {
  const idx = scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) return scenes;

  const src = scenes[idx];
  // El frame del split, relativo a la escena.
  const rel = atFrameAbsolute - src.startFrame;
  if (rel <= 4 || rel >= src.durationFrames - 4) {
    // Split demasiado cerca de un borde → no hacemos nada para evitar escenas degenerate.
    return scenes;
  }

  const maxNum = scenes.reduce((m, s) => Math.max(m, s.sceneNumber), 0);
  const splitAtAbs = src.startFrame + rel;

  const capSplit = splitCaptions(src.captions, splitAtAbs, maxNum + 1);
  const audSplit = splitAudio(src.audioTracks, splitAtAbs);

  const first: Scene = {
    ...src,
    durationFrames: rel,
    endFrame: src.startFrame + rel,
    captions: capSplit.left,
    audioTracks: audSplit.left,
    // overlays y effects se mantienen sólo si su rango queda dentro de la 1ª
    overlays: src.overlays.filter((o) => o.endFrame <= splitAtAbs),
    effects: src.effects.filter((e) => (e.endFrame ?? splitAtAbs) <= splitAtAbs),
  };

  const second: Scene = {
    ...src,
    id: mkSceneId(),
    sceneNumber: maxNum + 1,
    name: `${src.name} · cont.`,
    startFrame: splitAtAbs,
    endFrame: splitAtAbs + (src.durationFrames - rel),
    durationFrames: src.durationFrames - rel,
    captions: capSplit.right.map((c) => ({ ...c })),
    audioTracks: audSplit.right.map((t) => ({ ...t })),
    overlays: src.overlays.filter((o) => o.startFrame >= splitAtAbs),
    effects: src.effects.filter((e) => (e.startFrame ?? splitAtAbs) >= splitAtAbs),
    versions: [], // la nueva pieza arranca con historial limpio
    renderState: 'stale',
  };

  const out = scenes.slice();
  out.splice(idx, 1, first, second);
  return out;
}
