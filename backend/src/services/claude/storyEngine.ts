import Replicate from 'replicate';
import { STORY_MASTER_PROMPT } from '../../prompts/storyMasterPrompt';
import type { GeneratedStory } from '../../types/story';

const REPLICATE_MODEL = 'anthropic/claude-4-sonnet';

export interface StoryEngineInput {
  /** Lo que el usuario quiere ver — estilo, sujetos, composición. */
  visualPrompt: string;
  /** Lo que el usuario quiere contar — historia, tono, narrativa. */
  narrativePrompt?: string;
  model: string;
  /**
   * Lista de imágenes de referencia del personaje (data: URLs o http URLs).
   * La primera se usa como ancla visual para Claude. El resto se propagan
   * más tarde a la capa de generación de imágenes para identity preservation.
   */
  referenceImages?: string[];
  /** Número exacto de escenas que debe producir Claude. */
  sceneCount?: number;
}

let cachedClient: Replicate | null = null;

function getClient(): Replicate {
  if (cachedClient) return cachedClient;

  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) {
    throw new Error('REPLICATE_API_TOKEN is not set in environment');
  }

  cachedClient = new Replicate({ auth });
  return cachedClient;
}

function buildUserPrompt(input: StoryEngineInput): string {
  const parts: string[] = [
    `Prompt visual (qué ver, estilo, sujetos, composición, ambiente):\n${input.visualPrompt}`,
  ];

  if (input.narrativePrompt && input.narrativePrompt.trim().length > 0) {
    parts.push(
      `Prompt narrativo (historia, tono, secuencia, emociones, mensaje):\n${input.narrativePrompt}`
    );
  }

  parts.push(
    'Integra ambos prompts: el visual define cómo se ve cada escena; el narrativo define qué pasa y qué se siente. Usa el narrativo para encadenar las escenas en una historia con arco claro.'
  );

  if (typeof input.sceneCount === 'number' && input.sceneCount > 0) {
    parts.push(
      `Cantidad de escenas (OBLIGATORIO): genera EXACTAMENTE ${input.sceneCount} escenas. Ni una más, ni una menos. Distribuye el arco narrativo a lo largo de esas ${input.sceneCount} escenas con scene_number desde 1 hasta ${input.sceneCount}.`
    );
  }

  const refCount = input.referenceImages?.length ?? 0;
  if (refCount > 0) {
    parts.push(
      `Referencias del personaje: ${refCount} imagen(es) del personaje protagonista están disponibles para el modelo de imagen (frente, perfil, cuerpo, expresiones, ropa). Escribe los image_prompt asumiendo que el modelo VERÁ esas referencias y debe mantener identidad exacta (rostro, estructura facial, ojos, pelo, complexión, ropa cuando aplique). Describe la pose, escena y emoción; deja la identidad a las referencias.`
    );
  }

  parts.push(`Modelo destino para las imágenes: ${input.model}`);
  return parts.join('\n\n');
}

function extractJson(raw: string): string {
  let cleaned = raw.trim();

  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/i, '');
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function joinOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(String).join('');
  if (output == null) return '';
  return String(output);
}

export async function generateStoryFromPrompt(
  input: StoryEngineInput
): Promise<GeneratedStory> {
  const client = getClient();

  const replicateInput: Record<string, unknown> = {
    prompt: buildUserPrompt(input),
    system_prompt: STORY_MASTER_PROMPT,
    max_tokens: 4096,
    extended_thinking: false,
  };

  const refs = input.referenceImages ?? [];
  if (refs.length > 0) {
    // Replicate's Claude wrapper acepta `image` (singular). Mandamos la
    // primera como ancla; el set completo se reutiliza en la fase de
    // generación de imágenes para mantener la identidad del personaje.
    replicateInput.image = refs[0];
  }

  const output = await client.run(REPLICATE_MODEL, {
    input: replicateInput,
  });

  const rawText = joinOutput(output);
  if (!rawText) {
    throw new Error('Replicate returned empty output for Claude call');
  }

  const jsonString = extractJson(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    throw new Error(
      `Claude returned non-JSON output (parse failed: ${reason}). Raw preview: ${jsonString.slice(0, 200)}`
    );
  }

  return parsed as GeneratedStory;
}
