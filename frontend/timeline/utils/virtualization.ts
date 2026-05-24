/**
 * Cálculo de rango visible para virtualización ligera.
 *
 * Dado scrollLeft + viewport width, devuelve [startFrame, endFrame] con un
 * buffer para evitar pop-in cuando el usuario scrollea. Los track rows usan
 * esto para saltarse el render de clips muy lejanos.
 *
 * Es "virtualización ligera": no desmontamos componentes — sólo evitamos
 * pintar contenido pesado (waveforms, video thumbnails) fuera del viewport.
 * Para 50-100 clips típicos esto basta; si crece a miles habrá que añadir
 * unmount real.
 */

const BUFFER_PX = 200;

export function visibleFrameRange(
  scrollLeftPx: number,
  viewportWidthPx: number,
  pxPerFrame: number
): { start: number; end: number } {
  const start = Math.max(0, (scrollLeftPx - BUFFER_PX) / pxPerFrame);
  const end = (scrollLeftPx + viewportWidthPx + BUFFER_PX) / pxPerFrame;
  return { start: Math.floor(start), end: Math.ceil(end) };
}

export function isInRange(
  start: number,
  end: number,
  range: { start: number; end: number }
): boolean {
  return end >= range.start && start <= range.end;
}
