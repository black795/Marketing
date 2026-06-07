/**
 * Cliente del enhancer de prompts (POST /api/enhance-prompt).
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function enhancePrompt(
  text: string,
  kind: 'visual' | 'narrative',
  aestheticDirective?: string,
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/enhance-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, kind, aestheticDirective }),
  });
  const data = (await res.json()) as { success: boolean; text?: string; error?: string };
  if (!res.ok || !data.success || !data.text) {
    throw new Error(data.error || `Backend respondió ${res.status}`);
  }
  return data.text;
}
