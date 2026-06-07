/**
 * Mejora de prompts con Claude (vía Replicate, mismo modelo que storyEngine).
 *
 * Toma el texto del usuario (prompt visual o narrativo) y lo reescribe más
 * específico y evocativo, manteniendo su intención y las menciones @imagenN.
 * Devuelve texto plano (NO JSON).
 */
import Replicate from 'replicate';
import { runWebResearch, stripWebSearchMarkers } from '../webSearch';

const REPLICATE_MODEL = 'anthropic/claude-4-sonnet';

let cachedClient: Replicate | null = null;
function getClient(): Replicate {
  if (cachedClient) return cachedClient;
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) throw new Error('REPLICATE_API_TOKEN is not set in environment');
  cachedClient = new Replicate({ auth });
  return cachedClient;
}

function joinOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(String).join('');
  if (output == null) return '';
  return String(output);
}

const SYSTEM_PROMPT = `Sos un prompt engineer experto en generación de imagen/video con IA para contenido de redes (Reels, carruseles, UGC).
Tu tarea: reescribir el prompt del usuario para que sea más específico, visual y accionable, SIN cambiar su intención.

Reglas:
- Conservá el idioma del usuario.
- Mantené EXACTAMENTE cualquier mención tipo @imagen1, @img2 (son anclas de referencia; no las borres ni renombres).
- Para un prompt VISUAL: enriquecé estilo, sujeto, composición, encuadre, luz, paleta, textura y ambiente. Estética editorial, luz natural, look iPhone candid cuando aplique.
- Para un prompt NARRATIVO: clarificá el arco, el tono y la emoción; mantenelo breve.
- NO inventes una marca o producto que el usuario no mencionó.
- Devolvé SOLO el prompt mejorado, en texto plano. Sin comillas, sin explicaciones, sin encabezados.`;

export interface EnhancePromptInput {
  text: string;
  kind: 'visual' | 'narrative';
  /** Directiva de estética opcional (preset Realista/Cartoon/…) para alinear el look. */
  aestheticDirective?: string;
}

export async function enhancePrompt(input: EnhancePromptInput): Promise<string> {
  const client = getClient();

  // Marcas marcadas con * → datos reales de la web para enriquecer la mejora.
  const research = await runWebResearch([input.text], { label: 'enhance' });
  const cleanText = stripWebSearchMarkers(input.text).trim();

  const kindLabel = input.kind === 'narrative' ? 'NARRATIVO' : 'VISUAL';
  const parts = [`Tipo de prompt: ${kindLabel}.`];
  if (input.aestheticDirective?.trim()) {
    parts.push(`Estética objetivo a respetar: ${input.aestheticDirective.trim()}`);
  }
  if (research.contextBlock) {
    parts.push(
      `${research.contextBlock}\n(Incorporá estos datos reales al prompt mejorado cuando sean relevantes.)`,
    );
  }
  parts.push(`Prompt original:\n${cleanText}`);
  parts.push('Reescribilo mejorado (solo el texto):');

  const output = await client.run(REPLICATE_MODEL, {
    input: {
      prompt: parts.join('\n\n'),
      system_prompt: SYSTEM_PROMPT,
      max_tokens: 1024,
      extended_thinking: false,
    },
  });

  const text = joinOutput(output).trim();
  if (!text) throw new Error('Replicate devolvió una mejora vacía');
  // Por si el modelo envuelve en comillas o code fences.
  return text.replace(/^```[a-z]*\n?|\n?```$/g, '').replace(/^["']|["']$/g, '').trim();
}
