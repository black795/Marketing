/**
 * Tim Koda — Render Pipeline.
 *
 * El render real corre en el backend (ffmpeg, cache de segmentos, paralelo).
 * Este módulo expone el frontend del pipeline: cola, preview y export.
 *
 *   <RenderQueueProvider>
 *     <ExportPanel />
 *   </RenderQueueProvider>
 *
 * Sub-módulos:
 *   queue/     RenderQueueProvider + streamRenderJob + tipos
 *   export/    ExportPanel + LOCAL_EXPORT_PRESETS + aspectClassName
 *   preview/   ScenePreviewRenderer (preview CSS por escena)
 *   ffmpeg/    placeholder (futuro: ffmpeg.wasm, validación de codecs)
 *   remotion/  placeholder (futuro: adapter SceneGraph ↔ Remotion)
 */

export * from './queue';
export * from './export';
export * from './preview';
