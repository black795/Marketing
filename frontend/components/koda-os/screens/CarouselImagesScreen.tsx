'use client';

// Fase Carousel Generator — Generación REAL de imágenes con GPT Image 2.
//
// Cada slide aprobado genera una imagen reutilizando la integración existente
// (backend: imageWorker → Python worker → API/gpt_image_2.py). Permite generar
// un slide, un carrusel o todos; muestra estado/progreso/errores y reintentos;
// y persiste imagen + metadatos (prompt y referencias utilizadas). Generación
// en paralelo (acotada en el backend). Todo se guarda en el project-store.

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, ProgressBar, SectionHeader, Spinner } from '../primitives';
import { projectStore, useProject } from '../project-store';
import { streamGenerateCarouselImages } from '@/lib/carousel-images-api';
import { StreamCancelledError } from '@/lib/api';
import {
  CAROUSEL_IMAGE_MODEL,
  buildGptImageReferenceInputs,
  flattenCarouselReferences,
  resolveCarouselImageTokens,
  getPlatformOption,
  type Carousel,
  type CarouselImageResult,
  type CarouselImageTarget,
  type CarouselSlide,
} from '@/types/carousel';

type SlideStatus = 'pending' | 'active' | 'done' | 'error';

const QUALITY = 'standard';

function statusKey(carouselId: string, slideIndex: number): string {
  return `${carouselId}:${slideIndex}`;
}

export default function CarouselImagesScreen() {
  const router = useRouter();
  const { script, carouselConfig, carouselReferences, carousels, carouselSelectedId } = useProject();

  const allCarousels = carousels ?? [];
  // Solo se genera el carrusel elegido en la pantalla de revisión.
  const chosen = allCarousels.find((c) => c.id === carouselSelectedId) ?? allCarousels[0] ?? null;
  const list = chosen ? [chosen] : [];
  const refInputs = useMemo(() => buildGptImageReferenceInputs(carouselReferences), [carouselReferences]);
  const flatRefs = useMemo(() => flattenCarouselReferences(carouselReferences), [carouselReferences]);

  // Construye el target de un slide resolviendo sus tokens @imageN@: si el
  // prompt referencia imágenes puntuales, se mandan SOLO esas (y el prompt va
  // reescrito); si no, el slide usa las referencias del batch.
  function buildTarget(c: Carousel, s: CarouselSlide): CarouselImageTarget {
    const base = { carouselId: c.id, carouselIndex: c.index, slideIndex: s.index };
    const resolved = resolveCarouselImageTokens(s.imagePrompt, flatRefs);
    if (resolved.used) {
      return { ...base, prompt: resolved.prompt, referenceUrls: resolved.urls, referenceKinds: resolved.kinds };
    }
    return { ...base, prompt: s.imagePrompt };
  }
  const aspectRatio = getPlatformOption(carouselConfig.platform).aspectRatio;
  const projectId = script?.projectId ?? null;

  const [statusMap, setStatusMap] = useState<Map<string, SlideStatus>>(new Map());
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);

  // Guard: sin carruseles no hay nada que generar.
  React.useEffect(() => {
    if (allCarousels.length === 0) router.replace('/carousel');
  }, [allCarousels.length, router]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (list.length === 0) {
    return (
      <div style={{ padding: 48, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Cargando…</div>
    );
  }

  const isRunning = !!progress;

  function deriveStatus(c: Carousel, s: CarouselSlide): SlideStatus {
    const k = statusKey(c.id, s.index);
    if (statusMap.has(k)) return statusMap.get(k)!;
    if (s.imageUrl) return 'done';
    if (s.imageError) return 'error';
    return 'pending';
  }

  function setStatus(key: string, status: SlideStatus) {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(key, status);
      return next;
    });
  }

  async function run(targets: CarouselImageTarget[]) {
    if (isRunning || targets.length === 0) return;
    setError(null);
    userCancelledRef.current = false;
    setProgress({ total: targets.length, done: 0 });
    setStatusMap((prev) => {
      const next = new Map(prev);
      for (const t of targets) next.set(statusKey(t.carouselId, t.slideIndex), 'pending');
      return next;
    });

    const abort = new AbortController();
    abortRef.current = abort;

    const apply = (r: CarouselImageResult) => {
      projectStore.setCarouselSlideImage(r.carouselId, r.slideIndex, {
        imageUrl: r.imageUrl,
        imageError: r.imageError,
        imageMeta: r.meta,
      });
      setStatus(statusKey(r.carouselId, r.slideIndex), r.imageError ? 'error' : 'done');
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    };

    try {
      const outcome = await streamGenerateCarouselImages(
        {
          projectId,
          model: CAROUSEL_IMAGE_MODEL,
          quality: QUALITY,
          aspectRatio,
          referenceUrls: refInputs.urls.length > 0 ? refInputs.urls : undefined,
          referenceKinds: refInputs.kinds.length > 0 ? refInputs.kinds : undefined,
          targets,
        },
        {
          onSlideStart: ({ carouselId, slideIndex }) =>
            setStatus(statusKey(carouselId, slideIndex), 'active'),
          onSlide: apply,
        },
        abort.signal,
      );
      if (outcome.status === 'cancelled') {
        setError('Generación cancelada. Lo completado quedó guardado.');
      } else if (outcome.failed > 0) {
        setError(`${outcome.failed} imagen(es) fallaron. Podés reintentarlas.`);
      }
    } catch (err) {
      if (err instanceof StreamCancelledError) {
        if (userCancelledRef.current) setError('Generación cancelada.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudieron generar las imágenes');
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  function targetsForCarousel(c: Carousel): CarouselImageTarget[] {
    return c.slides.map((s) => buildTarget(c, s));
  }

  function generateAll() {
    void run(list.flatMap(targetsForCarousel));
  }
  function generateCarousel(c: Carousel) {
    void run(targetsForCarousel(c));
  }
  function generateSlide(c: Carousel, s: CarouselSlide) {
    void run([buildTarget(c, s)]);
  }

  function cancel() {
    userCancelledRef.current = true;
    abortRef.current?.abort();
    setProgress((p) => (p ? { ...p } : p));
  }

  const totalSlides = list.reduce((a, c) => a + c.slides.length, 0);
  const doneSlides = list.reduce((a, c) => a + c.slides.filter((s) => s.imageUrl).length, 0);
  const allDone = doneSlides === totalSlides && totalSlides > 0;

  const carousel = list[0];

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        kicker={`Fase 05 - Carrusel - Imágenes - ${doneSlides}/${totalSlides}`}
        title={isRunning ? 'Generando imágenes' : allDone ? 'Imágenes listas' : 'Generá las imágenes'}
        subtitle={`GPT Image 2 · ${aspectRatio} · ${refInputs.urls.length} referencia(s). Se generan en paralelo y se guardan con sus metadatos.`}
        actions={
          isRunning ? (
            <Button variant="danger" size="md" icon={Icon.X} onClick={cancel}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="md" icon={Icon.ArrowL} onClick={() => router.push('/carousel/review')}>
                Prompts
              </Button>
              <Button variant="secondary" size="md" icon={Icon.Sparkles} onClick={generateAll} disabled={totalSlides === 0}>
                Generar imágenes
              </Button>
              <Button variant="primary" size="md" icon={Icon.Arrow} onClick={() => router.push('/carousel/manage')} glow>
                Gestionar carruseles
              </Button>
            </>
          )
        }
      />

      {error && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--red-soft)',
            border: '1px solid var(--red-ring)',
            color: 'var(--red-hi)',
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Progreso global */}
      {progress && (
        <Card padding={16} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <Spinner size={20} color="var(--blue-hi)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
              {progress.done}/{progress.total} imágenes
            </span>
          </div>
          <ProgressBar value={progress.total > 0 ? progress.done / progress.total : 0} />
        </Card>
      )}

      {/* Carrusel elegido (único que se genera) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          marginBottom: 20,
          borderRadius: 10,
          background: 'var(--blue-soft)',
          border: '1px solid var(--blue)',
          maxWidth: 'fit-content',
        }}
      >
        <Badge tone="blue" size="sm">
          elegido
        </Badge>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-hi)' }}>
          C{String(carousel.index).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{carousel.title}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {carousel.slides.filter((s) => s.imageUrl).length}/{carousel.slides.length} listas
        </span>
        {allCarousels.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            icon={Icon.ArrowL}
            onClick={() => router.push('/carousel/review')}
            disabled={isRunning}
          >
            Cambiar
          </Button>
        )}
      </div>

      {/* Toolbar del carrusel activo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {carousel.title} · {carousel.slides.length} slides
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={Icon.Refresh}
          onClick={() => generateCarousel(carousel)}
          disabled={isRunning}
        >
          Generar carrusel
        </Button>
      </div>

      {/* Grid de slides */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {carousel.slides.map((s) => (
          <SlideImageCard
            key={s.index}
            carousel={carousel}
            slide={s}
            status={deriveStatus(carousel, s)}
            aspectRatio={aspectRatio}
            disabled={isRunning}
            onGenerate={() => generateSlide(carousel, s)}
          />
        ))}
      </div>
    </div>
  );
}

function SlideImageCard({
  carousel,
  slide,
  status,
  aspectRatio,
  disabled,
  onGenerate,
}: {
  carousel: Carousel;
  slide: CarouselSlide;
  status: SlideStatus;
  aspectRatio: string;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const ratio = aspectRatio.replace(':', ' / ');
  const isActive = status === 'active';
  const isDone = status === 'done' && !!slide.imageUrl;
  const isError = status === 'error' || !!slide.imageError;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-2)',
        border: `1px solid ${isActive ? 'var(--blue-ring)' : isError ? 'var(--red-ring)' : 'var(--line)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: ratio, background: 'var(--bg-3)' }}>
        {isDone ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={slide.imageUrl as string} alt={slide.suggestedText} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className={isActive ? '' : 'skeleton'} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            {isActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Spinner size={20} color="var(--blue-hi)" />
                <span className="mono upper" style={{ fontSize: 9, color: 'var(--blue-hi)', letterSpacing: 1 }}>
                  generando…
                </span>
              </div>
            ) : isError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8 }}>
                <Icon.X size={18} />
                <span className="mono upper" style={{ fontSize: 9, color: 'var(--red-hi)', letterSpacing: 1 }}>
                  error
                </span>
              </div>
            ) : (
              <span className="mono upper" style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: 1 }}>
                sin generar
              </span>
            )}
          </div>
        )}

        <span
          className="mono"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(7,8,11,0.78)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            backdropFilter: 'blur(6px)',
          }}
        >
          C{String(carousel.index).padStart(2, '0')} · S{String(slide.index).padStart(2, '0')}
        </span>
        {isDone && (
          <span style={{ position: 'absolute', top: 8, right: 8 }}>
            <Badge tone="success" size="sm" icon={Icon.Check}>
              ok
            </Badge>
          </span>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--fg-1)',
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={slide.headline || slide.suggestedText}
        >
          {slide.headline || slide.suggestedText || `Slide ${slide.index}`}
        </div>
        {isError && slide.imageError && (
          <p style={{ fontSize: 10, color: 'var(--red-hi)', margin: '0 0 8px', lineHeight: 1.4 }}>
            {slide.imageError}
          </p>
        )}
        <Button
          variant={isError ? 'danger' : isDone ? 'ghost' : 'secondary'}
          size="sm"
          icon={isError ? Icon.Refresh : isDone ? Icon.Refresh : Icon.Sparkles}
          onClick={onGenerate}
          disabled={disabled || isActive}
          style={{ width: '100%' }}
        >
          {isError ? 'Reintentar' : isDone ? 'Regenerar' : 'Generar'}
        </Button>
      </div>
    </div>
  );
}
