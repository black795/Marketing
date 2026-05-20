// Precios orientativos al momento de implementar. Verificá en replicate.com
// porque cambian sin aviso. La UI muestra un disclaimer al usuario.

import type { VideoModel } from '@/types/story';

export const VIDEO_PRICING: Record<VideoModel, { perSecond: number }> = {
  'kling-v3': { perSecond: 0.04 },
  'kling-v3-omni': { perSecond: 0.07 },
};

export interface CostEstimate {
  totalUsd: number;
  perVideoUsd: number;
  perSecondUsd: number;
}

export function estimateVideoCost(params: {
  model: VideoModel;
  duration: number;
  count: number;
}): CostEstimate {
  const pricing = VIDEO_PRICING[params.model];
  const perVideoUsd = pricing.perSecond * params.duration;
  return {
    totalUsd: perVideoUsd * params.count,
    perVideoUsd,
    perSecondUsd: pricing.perSecond,
  };
}

export function formatUsd(amount: number): string {
  if (amount < 0.01) return '< $0.01';
  return `$${amount.toFixed(2)}`;
}
