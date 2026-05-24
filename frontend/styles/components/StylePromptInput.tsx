'use client';

import { useState } from 'react';
import type { StylePack } from '../configs/style-pack';
import { matchStyleFromPrompt } from '../utils/prompt-mapping';

interface Props {
  onMatch: (pack: StylePack) => void;
}

/**
 * Caja para escribir lenguaje natural y disparar la aplicación de un StylePack.
 *
 *   "hazlo más viral"      → tiktok-viral
 *   "tipo MrBeast"         → mrbeast
 *   "más elegante"         → luxury
 *   "estética anime"       → anime
 *
 * Si no encuentra match, lo dice. El caller decide si lo aplica al proyecto
 * entero o sólo a la escena seleccionada (eso vive en el caller).
 */
export default function StylePromptInput({ onMatch }: Props) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit() {
    const t = text.trim();
    if (!t) return;
    const match = matchStyleFromPrompt(t);
    if (!match) {
      setFeedback(
        'No reconocí ningún estilo. Prueba: "más viral", "tipo MrBeast", "más elegante", "estética anime".'
      );
      return;
    }
    setFeedback(
      `${match.pack.emoji} ${match.pack.label} (${match.score} pts · ${match.reasons.slice(0, 2).join(', ')})`
    );
    onMatch(match.pack);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder='Escribe el estilo — ej. "más viral", "tipo MrBeast", "más elegante"…'
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        <button
          type="button"
          onClick={submit}
          disabled={text.trim().length === 0}
          className="rounded-md bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-600 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
      {feedback && (
        <p
          className={`text-[10px] ${
            feedback.startsWith('No reconocí') ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
