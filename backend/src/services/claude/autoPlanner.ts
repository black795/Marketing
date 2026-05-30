import Replicate from 'replicate';

const REPLICATE_MODEL = 'anthropic/claude-4-sonnet';

let cachedClient: Replicate | null = null;
function getClient(): Replicate {
  if (cachedClient) return cachedClient;
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) throw new Error('REPLICATE_API_TOKEN is not set in environment');
  cachedClient = new Replicate({ auth });
  return cachedClient;
}

export interface AutoPlannerInput {
  /** Lo que el usuario quiere lograr. Texto libre en cualquier idioma. */
  prompt: string;
  /** Escenas disponibles con su duración real (en segundos). */
  scenes: Array<{
    sceneNumber: number;
    durationSeconds: number;
  }>;
  /** Ids de estilos de subtítulos que el modelo puede elegir. */
  availableStyles: string[];
}

export interface AutoPlanCaption {
  text: string;
  startSeconds: number;
  durationSeconds: number;
  style: string;
}

export interface AutoPlan {
  /** sceneNumbers en el orden deseado. Vacío = todas en orden natural. */
  sceneOrder: number[];
  /** Subtítulos a quemar en el video final. */
  captions: AutoPlanCaption[];
  /** Breve explicación del LLM de lo que decidió. */
  reasoning: string;
}

function joinOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(String).join('');
  if (output == null) return '';
  return String(output);
}

function extractJson(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/i, '');
  cleaned = cleaned.trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

const SYSTEM_PROMPT = `Sos el editor del Tim Koda Creative OS — pipeline de Reels / TikToks /
short-form. Convertís un prompt + un set de clips ya filmados en un PLAN DE
EDICIÓN ejecutable, con la voz y reglas de Tim Koda.

# VOZ Y TONO (de CLAUDE.md)
- Bold and direct, casual but knowledgeable.
- Idioma: respondé en el mismo idioma del prompt del usuario.
- NUNCA uses: "game-changing", "unleash", "dive in", "revolutionary", "epic".
- Siempre: específico, visual, accionable. Cada palabra se gana su lugar.

# ESTRUCTURA NARRATIVA (skill /script — 5 bloques)
Mentalmente armás el guion en 5 bloques antes de generar captions:
  1. HOOK (0-3s)         — 1-2 frases que paran el scroll. Claim o disrupción.
  2. PRE-CTA (~1s)       — Tease del valor que viene al final.
  3. WALKTHROUGH (60-70%) — La carne. Show, don't describe. Sin "primero/después" numerados, sí transiciones suaves.
  4. TRANSITION (~1s)    — Una frase aspiracional o de contraste.
  5. CTA (~3s)           — Llamado claro. Si pide "comentá X", X = 1 palabra, máx 5 letras.

# SHOT DECK (skill /storyboard)
El sceneOrder es tu shot deck. Cada escena ocupa un slot temporal con su
durationSeconds real (vienen en el input). Cortes duros, sin fades.
- Primer shot = el visual MÁS fuerte (estopa el scroll).
- Si el usuario no indica orden, agrupá los shots para servir al arco
  HOOK → WALKTHROUGH → CTA.

# CAPTIONS = TEXT OVERLAYS DEL SHOT DECK
- Máximo 3-5 palabras por caption (legibles en mobile).
- Sincronizá los captions con la cadencia narrativa: HOOK lleva su caption
  fuerte, cada cambio de idea = nuevo caption.
- startSeconds en tiempo absoluto del video final (ya considerando sceneOrder).
- durationSeconds: típicamente 1-2.5s. Largo solo si es la CTA final.
- Cada caption cae DENTRO del rango total del video. Si te excedés, recortá.
- Si el usuario NO pide subtítulos, devolvé captions: [].

# ESTILO DE SUBTÍTULOS
Elegí UN style para todo el video (coherencia visual). Mapping orientativo:
  - "tiktok-yellow" → Reels casuales, energía alta, audiencia joven.
  - "hormozi-green" → Educational, business, frases punchy en mayúsculas.
  - "mrbeast-white" → Mass appeal, hype, contenido viral.
  - "minimal"       → Documental, branding premium, tono sereno.
  - "highlight"     → Resaltar 1-2 palabras clave (marker fluo).
  - "karaoke"       → Música, lyrics, contenido performativo.
  - "default"       → Cualquier otro caso.

# FORMATO DE SALIDA
SOLO objeto JSON (sin texto antes/después, sin markdown), con EXACTAMENTE
estos campos:

{
  "sceneOrder": [int],            // sceneNumbers en el orden de aparición.
                                  //   Sin repetidos. Podés omitir.
  "captions": [
    {
      "text": "string",           // 3-5 palabras, en el idioma del usuario.
      "startSeconds": number,     // Tiempo absoluto del video final.
      "durationSeconds": number,  // 1-2.5s típico.
      "style": "string"           // Uno de los styleIds permitidos.
    }
  ],
  "reasoning": "string"           // 1-2 frases: qué arco narrativo elegiste y por qué.
}

REGLAS DURAS:
- No inventes sceneNumbers que no existan en la lista provista.
- No metas captions fuera del rango total del video.
- No uses palabras prohibidas de la sección VOZ Y TONO.
- Si el prompt no da contexto suficiente, usá el orden natural y captions mínimos
  pero NUNCA inventes promesas/datos falsos.`;

function buildUserPrompt(input: AutoPlannerInput): string {
  const sceneList = input.scenes
    .map((s) => `  - scene ${s.sceneNumber}: ${s.durationSeconds}s`)
    .join('\n');
  return [
    `Prompt del usuario:`,
    input.prompt.trim(),
    ``,
    `Escenas disponibles (con duración real en el clip original):`,
    sceneList,
    ``,
    `Estilos de subtítulos permitidos (elegí UNO):`,
    input.availableStyles.map((s) => `  - ${s}`).join('\n'),
    ``,
    `Recordá: respondé SOLO el JSON, nada más.`,
  ].join('\n');
}

export async function planFromPrompt(input: AutoPlannerInput): Promise<AutoPlan> {
  const client = getClient();
  const output = await client.run(REPLICATE_MODEL, {
    input: {
      prompt: buildUserPrompt(input),
      system_prompt: SYSTEM_PROMPT,
      max_tokens: 2048,
      extended_thinking: false,
    },
  });

  const raw = joinOutput(output);
  if (!raw) throw new Error('Replicate devolvió output vacío');

  const jsonStr = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    throw new Error(
      `Claude devolvió JSON inválido (${reason}). Preview: ${jsonStr.slice(0, 200)}`
    );
  }

  return normalizePlan(parsed, input);
}

function normalizePlan(raw: unknown, input: AutoPlannerInput): AutoPlan {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Plan inválido: no es objeto JSON');
  }
  const obj = raw as Record<string, unknown>;

  const validScenes = new Set(input.scenes.map((s) => s.sceneNumber));
  const sceneOrderRaw = Array.isArray(obj.sceneOrder) ? obj.sceneOrder : [];
  const sceneOrder: number[] = [];
  const seenScenes = new Set<number>();
  for (const n of sceneOrderRaw) {
    const v = Number(n);
    if (!Number.isInteger(v)) continue;
    if (!validScenes.has(v)) continue;
    if (seenScenes.has(v)) continue;
    seenScenes.add(v);
    sceneOrder.push(v);
  }

  const validStyles = new Set(input.availableStyles);
  const captionsRaw = Array.isArray(obj.captions) ? obj.captions : [];
  const captions: AutoPlanCaption[] = [];
  for (const c of captionsRaw) {
    if (!c || typeof c !== 'object') continue;
    const cc = c as Record<string, unknown>;
    const text = typeof cc.text === 'string' ? cc.text.trim() : '';
    if (!text) continue;
    const start = Number(cc.startSeconds);
    const dur = Number(cc.durationSeconds);
    if (!Number.isFinite(start) || start < 0) continue;
    if (!Number.isFinite(dur) || dur <= 0) continue;
    const styleId = typeof cc.style === 'string' ? cc.style : 'default';
    const style = validStyles.has(styleId) ? styleId : 'default';
    captions.push({ text, startSeconds: start, durationSeconds: dur, style });
  }

  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';

  return { sceneOrder, captions, reasoning };
}
