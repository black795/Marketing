'use client';

import { useEffect, useRef, useState } from 'react';
import LoadingButton from './loading/LoadingButton';

export type CompareDecision = 'keep' | 'replace' | 'both';

interface CompareDialogProps {
  open: boolean;
  title?: string;
  originalUrl: string | null;
  originalLabel?: string;
  newUrl: string | null;
  newLabel?: string;
  newError?: string;
  promptDiff?: { before: string; after: string };
  onClose: () => void;
  onDecide: (decision: CompareDecision) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function CompareDialog({
  open,
  title = 'Comparar versiones',
  originalUrl,
  originalLabel = 'Original',
  newUrl,
  newLabel = 'Nueva versión',
  newError,
  promptDiff,
  onClose,
  onDecide,
}: CompareDialogProps) {
  const [slider, setSlider] = useState(50); // 0..100
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<null | { startX: number; startY: number; baseX: number; baseY: number }>(
    null
  );
  const [draggingSlider, setDraggingSlider] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlider(50);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShowDiff(false);
  }, [open, newUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX_ZOOM, z + 0.25));
      if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(MIN_ZOOM, z - 0.25));
      if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleSliderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setDraggingSlider(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSlider(e);
  }
  function handleSliderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingSlider) return;
    updateSlider(e);
  }
  function handleSliderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    setDraggingSlider(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function updateSlider(e: React.PointerEvent<HTMLDivElement>) {
    const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = ((e.clientX - target.left) / target.width) * 100;
    setSlider(Math.max(0, Math.min(100, pct)));
  }

  function handleImageWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }

  function handlePanStart(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return;
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handlePanMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setPan({
      x: draggingRef.current.baseX + (e.clientX - draggingRef.current.startX),
      y: draggingRef.current.baseY + (e.clientY - draggingRef.current.startY),
    });
  }
  function handlePanEnd(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const newReady = !!newUrl;
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative flex h-[92vh] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            <span className="rounded-full bg-brand-yellow/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800">
              {originalLabel} ↔ {newLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {promptDiff && (
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                {showDiff ? 'Ocultar prompt' : 'Ver prompt'}
              </button>
            )}
            <ZoomControl
              zoom={zoom}
              onZoomChange={(z) => {
                setZoom(z);
                if (z === 1) setPan({ x: 0, y: 0 });
              }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comparación"
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden bg-neutral-950 p-3 md:flex-row">
          <div
            onWheel={handleImageWheel}
            onPointerDown={handlePanStart}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerCancel={handlePanEnd}
            className={`relative flex-1 select-none overflow-hidden rounded-lg bg-neutral-900 ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{ touchAction: 'none' }}
          >
            {originalUrl ? (
              // imagen base (original)
              <img
                src={originalUrl}
                alt={originalLabel}
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-contain transition-transform duration-100 ease-out"
                style={{ transform, transformOrigin: 'center center' }}
              />
            ) : (
              <Empty label="Sin imagen original" />
            )}

            {newReady ? (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
              >
                <img
                  src={newUrl ?? ''}
                  alt={newLabel}
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-contain"
                  style={{ transform, transformOrigin: 'center center' }}
                />
              </div>
            ) : newError ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-300">
                {newError}
              </div>
            ) : null}

            {/* Labels en esquinas */}
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {originalLabel}
            </span>
            {newReady && (
              <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-brand-pink/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {newLabel}
              </span>
            )}

            {/* Slider */}
            {newReady && (
              <div
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
                className="absolute inset-0"
                style={{ touchAction: 'none' }}
              >
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                  style={{ left: `${slider}%` }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-lg"
                  style={{ left: `${slider}%` }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                    <polyline points="9 6 15 12 9 18" transform="translate(6 0)" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {showDiff && promptDiff && (
            <div className="w-full max-w-sm overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-200 md:max-w-md">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                Prompt original
              </p>
              <pre className="mb-4 whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] leading-relaxed">
                {promptDiff.before}
              </pre>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-pink">
                Prompt nuevo
              </p>
              <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] leading-relaxed">
                {promptDiff.after}
              </pre>
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-neutral-200 bg-white px-5 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-neutral-500">
            Arrastra el separador para comparar · scroll para zoom · arrastrar
            con zoom &gt; 1 para mover · <kbd className="rounded border border-neutral-300 px-1">0</kbd>{' '}
            para resetear
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <LoadingButton
              variant="secondary"
              onClick={() => onDecide('keep')}
            >
              Conservar original
            </LoadingButton>
            <LoadingButton
              variant="secondary"
              onClick={() => onDecide('both')}
              disabled={!newReady}
            >
              Guardar ambas
            </LoadingButton>
            <LoadingButton
              variant="primary"
              onClick={() => onDecide('replace')}
              disabled={!newReady}
            >
              Reemplazar
            </LoadingButton>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
      {label}
    </div>
  );
}

function ZoomControl({
  zoom,
  onZoomChange,
}: {
  zoom: number;
  onZoomChange: (z: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 px-1 py-0.5 text-xs text-neutral-700">
      <button
        type="button"
        onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 0.25))}
        aria-label="Zoom out"
        className="rounded p-1 hover:bg-neutral-100"
      >
        −
      </button>
      <span className="min-w-[2.75rem] text-center font-mono">{zoom.toFixed(2)}x</span>
      <button
        type="button"
        onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 0.25))}
        aria-label="Zoom in"
        className="rounded p-1 hover:bg-neutral-100"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onZoomChange(1)}
        aria-label="Reset zoom"
        className="ml-1 rounded px-1 text-[10px] font-semibold uppercase hover:bg-neutral-100"
      >
        1:1
      </button>
    </div>
  );
}
