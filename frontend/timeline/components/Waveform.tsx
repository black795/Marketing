'use client';

import { useMemo } from 'react';
import type { Scene } from '@/editing';

interface Props {
  scene: Scene;
  widthPx: number;
  /** Color tailwind ej. 'bg-indigo-300'. */
  barColor: string;
  /** Si false, no pinta (virtualización). */
  visible: boolean;
}

/**
 * Waveform sintético — barras de amplitud derivadas de la densidad de
 * palabras de los captions de la escena. No es el audio real (ese requiere
 * decoding) pero da un proxy visual coherente con el pacing.
 *
 * Cuando entre transcripción real con timing de palabras, este componente
 * sigue funcionando idéntico — sólo recibe `words[]` más precisos.
 */
export default function Waveform({ scene, widthPx, barColor, visible }: Props) {
  const bars = useMemo(() => {
    if (!visible) return [];
    const target = Math.max(8, Math.min(120, Math.floor(widthPx / 4)));
    const arr = new Array<number>(target).fill(0);
    const words = scene.captions.flatMap((c) => c.words);
    if (words.length === 0) return arr;

    const start = scene.startFrame;
    const span = Math.max(scene.durationFrames, 1);
    for (const w of words) {
      const t = (w.startFrame - start) / span;
      const idx = Math.max(0, Math.min(target - 1, Math.floor(t * target)));
      arr[idx] += 1;
    }
    // Normaliza 0..1 y curva suave.
    const max = Math.max(1, ...arr);
    return arr.map((v) => 0.35 + 0.65 * Math.sqrt(v / max));
  }, [scene, widthPx, visible]);

  if (!visible) {
    return <div className="h-full w-full bg-[var(--bg-3)]" aria-hidden />;
  }

  return (
    <div className="flex h-full items-center gap-px overflow-hidden">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-sm ${barColor}`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}
