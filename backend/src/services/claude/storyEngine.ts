import Replicate from 'replicate';
import { STORY_MASTER_PROMPT } from '../../prompts/storyMasterPrompt';
import type { GeneratedStory } from '../../types/story';

const REPLICATE_MODEL = 'anthropic/claude-4-sonnet';

export interface StoryEngineInput {
  prompt: string;
  storyGuide?: string;
  model: string;
  referenceImage?: string;
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
  const parts: string[] = [`Idea principal: ${input.prompt}`];

  if (input.storyGuide && input.storyGuide.trim().length > 0) {
    parts.push(`Story guide / tono: ${input.storyGuide}`);
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

  if (input.referenceImage) {
    replicateInput.image = input.referenceImage;
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
