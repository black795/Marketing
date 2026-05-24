'use client';

import type { ReactNode } from 'react';

interface Props {
  heightPx: number;
  widthPx: number;
  children: ReactNode;
  /** Tono de fondo. */
  tone?: 'default' | 'muted';
}

/**
 * Wrapper genérico de una fila del timeline — la zona donde se posicionan
 * los clips (no incluye el header).
 */
export default function TrackRow({ heightPx, widthPx, children, tone = 'default' }: Props) {
  return (
    <div
      className={`relative border-b border-neutral-200 ${
        tone === 'muted' ? 'bg-neutral-100' : 'bg-white'
      }`}
      style={{ height: heightPx, width: widthPx }}
    >
      {children}
    </div>
  );
}
