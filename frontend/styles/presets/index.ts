/**
 * Catálogo central de StylePacks. Añadir uno = exportar un archivo nuevo
 * que defina un StylePack y añadirlo aquí. NO hay nada hardcoded más allá.
 */
import type { StylePack } from '../configs/style-pack';
import TIKTOK_VIRAL from './tiktok-viral';
import HORMOZI from './hormozi';
import MRBEAST from './mrbeast';
import PODCAST from './podcast';
import DOCUMENTARY from './documentary';
import GAMING from './gaming';
import LUXURY from './luxury';
import ANIME from './anime';

export const STYLE_PACKS: StylePack[] = [
  TIKTOK_VIRAL,
  HORMOZI,
  MRBEAST,
  PODCAST,
  DOCUMENTARY,
  GAMING,
  LUXURY,
  ANIME,
];

export function getStylePack(id: string): StylePack | null {
  return STYLE_PACKS.find((p) => p.id === id) ?? null;
}

export {
  TIKTOK_VIRAL,
  HORMOZI,
  MRBEAST,
  PODCAST,
  DOCUMENTARY,
  GAMING,
  LUXURY,
  ANIME,
};
