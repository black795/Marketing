'use client';

import type { Scene } from '@/editing';
import { sceneStatusUi, statusLabel, statusColor } from '../utils/status';

interface Props {
  scene: Scene;
  className?: string;
}

export default function SceneStatusBadge({ scene, className = '' }: Props) {
  const status = sceneStatusUi(scene);
  const c = statusColor(status);
  const pulse =
    status === 'generating' || status === 'regenerating' ? 'animate-pulse' : '';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${c.bg} ${c.text} ${c.ring} ${pulse} ${className}`}
    >
      {status === 'rendered' && '✓ '}
      {status === 'failed' && '✗ '}
      {status === 'modified' && '✎ '}
      {(status === 'generating' || status === 'regenerating') && '◌ '}
      {statusLabel(status)}
    </span>
  );
}
