/**
 * Regenerator de voz — re-sincroniza el word-timing de los captions.
 *
 * Sin acceso a transcripción real, redistribuye uniformemente las palabras
 * dentro del rango del caption (idéntico al algoritmo del builder original).
 * Cuando entre Whisper, esta función se sustituye por una llamada a la API.
 */
import type { Scene, TimelineProject, SceneCaption, SceneWord } from '@/editing';
import type { RegenContext } from './_types';

export function regenerateVoice(
  scene: Scene,
  _project: TimelineProject,
  _ctx: RegenContext
): Partial<Scene> {
  if (scene.captions.length === 0) return {};
  const captions: SceneCaption[] = scene.captions.map((c) => ({
    ...c,
    words: redistributeUniform(c.text, c.startFrame, c.endFrame),
  }));
  return { captions };
}

function redistributeUniform(
  text: string,
  startFrame: number,
  endFrame: number
): SceneWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(endFrame - startFrame, 1);
  const per = span / tokens.length;
  return tokens.map((tok, i) => ({
    text: tok,
    startFrame: Math.round(startFrame + per * i),
    endFrame: Math.round(startFrame + per * (i + 1)),
  }));
}
