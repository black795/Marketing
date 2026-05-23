/**
 * Registro central de proveedores de captions.
 *
 * Para añadir un proveedor nuevo: impleméntalo según `CaptionsProvider` y
 * agrégalo a `PROVIDERS`. Nada más cambia — ni rutas ni UI ni store.
 */
import type { CaptionsProvider } from './types';
import { captionsAiProvider } from './providers/captionsAi';
import {
  submagicProvider,
  capsubsProvider,
  whisperLocalProvider,
} from './providers/stub';

/** Orden = orden en que aparecen en la UI y se intentan en el fallback. */
const PROVIDERS: CaptionsProvider[] = [
  captionsAiProvider,
  submagicProvider,
  capsubsProvider,
  whisperLocalProvider,
];

const BY_ID = new Map(PROVIDERS.map((p) => [p.info.id, p]));

export function listProviders(): CaptionsProvider[] {
  return PROVIDERS;
}

export function getProvider(id: string): CaptionsProvider | undefined {
  return BY_ID.get(id);
}

export function isKnownProvider(id: string): boolean {
  return BY_ID.has(id);
}
