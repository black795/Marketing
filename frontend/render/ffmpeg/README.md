# /render/ffmpeg

Placeholder para futuros helpers client-side relacionados con ffmpeg.

El render real corre server-side (`backend/src/services/render.ts`). Este
sub-módulo queda reservado para:

- Inspección de presets ffmpeg desde el frontend.
- `ffmpeg.wasm` para previews ultra-rápidos en navegador.
- Util de validación de codecs antes de encolar un render.

Por ahora no exporta nada — añadir helpers cuando se necesiten.
