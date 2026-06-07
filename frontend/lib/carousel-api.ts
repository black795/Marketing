/**
 * Cliente API del Carousel Generator.
 *
 * PREPARADO para el siguiente paso. El backend valida la config y responde
 * 501 (Not Implemented) hasta que se construya la generación real. Esta
 * función ya maneja ese contrato para que la pantalla pueda llamarla sin
 * cambios cuando la generación esté lista.
 */
import type {
  GenerateCarouselRequest,
  GenerateCarouselResponse,
} from '@/types/carousel';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export class CarouselNotImplementedError extends Error {
  constructor(message = 'La generación de carruseles aún no está implementada.') {
    super(message);
    this.name = 'CarouselNotImplementedError';
  }
}

export async function generateCarousel(
  payload: GenerateCarouselRequest,
  options: { signal?: AbortSignal } = {}
): Promise<GenerateCarouselResponse> {
  const response = await fetch(`${BACKEND_URL}/api/generate-carousel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  // 501: contrato válido pero generación todavía no construida.
  if (response.status === 501) {
    let detail: string | undefined;
    try {
      detail = ((await response.json()) as { error?: string }).error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new CarouselNotImplementedError(detail);
  }

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return (await response.json()) as GenerateCarouselResponse;
}
