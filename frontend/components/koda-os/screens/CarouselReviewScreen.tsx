'use client';

// Fase Carousel Generator — Revisión y aprobación de PROMPTS.
//
// Claude genera, por cada carrusel, el plan de slides (objetivo visual,
// composición, texto sugerido, prompt GPT Image 2, elementos clave). El usuario
// edita, regenera una slide o un carrusel completo, y aprueba. Todo se persiste
// en el project-store (sessionStorage) y se cachea por firma de inputs, así
// volver atrás no pierde nada y no se re-llama a Claude sin necesidad.
//
// NO genera imágenes: solo prompts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, ProgressBar, SectionHeader, Spinner } from '../primitives';
import { projectStore, useProject } from '../project-store';
import { generateCarousel, regenerateSlide } from '@/lib/carousel-prompts-api';
import { fetchVisualStyles, buildStyleContext } from '@/lib/visual-styles';
import { buildAestheticContext } from '@/types/aesthetic';
import {
  carouselPromptSignature,
  flattenCarouselReferences,
  getPlatformOption,
  summarizeReferences,
  type Carousel,
  type CarouselComparisonSide,
  type CarouselSlide,
  type CarouselSlideRole,
} from '@/types/carousel';

function roleLabel(role: CarouselSlideRole): string {
  if (role === 'cover') return 'Portada · Hook';
  if (role === 'cta') return 'Cierre · CTA';
  return 'Contenido';
}

function makeCarouselId(index: number): string {
  return `cr-${index}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

export default function CarouselReviewScreen() {
  const router = useRouter();
  const { script, carouselConfig, carouselReferences, carousels, carouselPromptsApproved, carouselPromptsSig, carouselStyleId, carouselSelectedId } =
    useProject();

  const cfg = carouselConfig;
  const signature = useMemo(
    () => carouselPromptSignature(cfg, carouselReferences),
    [cfg, carouselReferences],
  );
  const referencesSummary = useMemo(() => summarizeReferences(carouselReferences), [carouselReferences]);
  const flatRefs = useMemo(() => flattenCarouselReferences(carouselReferences), [carouselReferences]);
  const projectContext = useMemo(() => {
    if (!script) return undefined;
    return [script.title, script.style].filter(Boolean).join(' — ') || undefined;
  }, [script]);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCarousel, setActiveCarousel] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [regenSlideBusy, setRegenSlideBusy] = useState(false);
  const [regenCarouselBusy, setRegenCarouselBusy] = useState<string | null>(null);
  const [slideCountBusy, setSlideCountBusy] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  // Estilo visual guardado a imitar: se resuelve a un bloque de contexto.
  const [styleContext, setStyleContext] = useState<string | undefined>(undefined);
  const [styleLoaded, setStyleLoaded] = useState(false);
  useEffect(() => {
    const aestheticBlock = buildAestheticContext(cfg.aestheticId);
    const combine = (styleBlock?: string) =>
      [aestheticBlock, styleBlock].filter((s): s is string => Boolean(s)).join('\n\n') || undefined;
    if (!carouselStyleId) {
      setStyleContext(combine());
      setStyleLoaded(true);
      return;
    }
    setStyleLoaded(false);
    fetchVisualStyles()
      .then((reg) => {
        const st = reg.styles.find((s) => s.id === carouselStyleId);
        setStyleContext(combine(st ? buildStyleContext(st) : undefined));
      })
      .catch(() => setStyleContext(combine()))
      .finally(() => setStyleLoaded(true));
  }, [carouselStyleId, cfg.aestheticId]);

  const list = carousels ?? [];

  // ---- Generación de todo el set (secuencial, incremental) ----
  async function generateAll(force: boolean) {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setProgress({ total: cfg.count, done: 0 });
    const abort = new AbortController();
    abortRef.current = abort;

    const out: Carousel[] = [];
    try {
      for (let i = 1; i <= cfg.count; i++) {
        if (abort.signal.aborted) break;
        const c = await generateCarousel(
          { config: cfg, carouselIndex: i, signature, references: referencesSummary, projectContext, styleContext, force },
          { signal: abort.signal },
        );
        out.push({
          id: makeCarouselId(i),
          index: i,
          config: cfg,
          title: c.title,
          slides: c.slides,
          createdAt: new Date().toISOString(),
        });
        // Persistencia incremental: si el usuario sale, no pierde lo generado.
        projectStore.setCarouselPrompts([...out], signature);
        setProgress({ total: cfg.count, done: i });
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'No se pudieron generar los prompts');
      }
    } finally {
      setGenerating(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  // ---- Mount: redirigir si falta brief; (re)generar si hace falta ----
  useEffect(() => {
    if (!cfg.productBrief.trim()) {
      router.replace('/carousel');
      return;
    }
    if (!styleLoaded) return; // esperar a resolver el estilo antes de generar
    if (startedRef.current) return;
    const haveAll = list.length === cfg.count && carouselPromptsSig === signature;
    startedRef.current = true;
    if (haveAll) return; // reusar lo persistido/cacheado
    void generateAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleLoaded]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ---- Regenerar un carrusel completo ----
  async function regenCarousel(carousel: Carousel) {
    if (regenCarouselBusy) return;
    setRegenCarouselBusy(carousel.id);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const c = await generateCarousel(
        { config: cfg, carouselIndex: carousel.index, signature, references: referencesSummary, projectContext, styleContext, force: true },
        { signal: abort.signal },
      );
      projectStore.replaceCarousel({ ...carousel, title: c.title, slides: c.slides, createdAt: new Date().toISOString() });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'No se pudo regenerar el carrusel');
      }
    } finally {
      setRegenCarouselBusy(null);
      abortRef.current = null;
    }
  }

  // ---- Regenerar una slide ----
  async function regenSlide(carousel: Carousel, slide: CarouselSlide) {
    if (regenSlideBusy) return;
    setRegenSlideBusy(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const next = await regenerateSlide(
        {
          config: cfg,
          carouselIndex: carousel.index,
          slideIndex: slide.index,
          references: referencesSummary,
          projectContext,
          styleContext,
          siblingSlides: carousel.slides,
        },
        { signal: abort.signal },
      );
      projectStore.updateCarouselSlide(carousel.id, slide.index, { ...next, index: slide.index });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'No se pudo regenerar la slide');
      }
    } finally {
      setRegenSlideBusy(false);
      abortRef.current = null;
    }
  }

  // ---- Agregar una slide nueva al carrusel (genera su prompt) ----
  async function addSlide(carousel: Carousel) {
    if (slideCountBusy) return;
    setSlideCountBusy(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const newIndex = carousel.slides.length + 1;
      const next = await regenerateSlide(
        {
          config: cfg,
          carouselIndex: carousel.index,
          slideIndex: newIndex,
          references: referencesSummary,
          projectContext,
          styleContext,
          siblingSlides: carousel.slides,
        },
        { signal: abort.signal },
      );
      projectStore.addCarouselSlide(carousel.id, { ...next, index: newIndex });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'No se pudo agregar la slide');
      }
    } finally {
      setSlideCountBusy(false);
      abortRef.current = null;
    }
  }

  // ---- Quitar la última slide del carrusel ----
  function removeLastSlide(carousel: Carousel) {
    if (carousel.slides.length <= 2) return;
    const last = carousel.slides[carousel.slides.length - 1];
    projectStore.removeCarouselSlide(carousel.id, last.index);
    setActiveSlide((s) => Math.min(s, carousel.slides.length - 2));
  }

  // ---- Elegir qué carrusel se convertirá en imágenes ----
  function selectCarousel(id: string) {
    projectStore.setCarouselSelectedId(id);
  }

  function approve() {
    // El carrusel elegido (o el primero por defecto) es el único que pasa a imágenes.
    const chosen = carouselSelectedId ?? list[0]?.id ?? null;
    projectStore.setCarouselSelectedId(chosen);
    projectStore.approveCarouselPrompts();
    router.push('/carousel/images');
  }

  // ---- Render: estado de generación inicial ----
  if (generating && list.length === 0) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 05 - Carrusel - Prompts"
          title="Generando prompts con Claude"
          subtitle="Cada carrusel se arma slide por slide. Podés editarlos y regenerarlos después."
        />
        <Card padding={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <Spinner size={22} color="var(--blue-hi)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>
              {progress ? `Carrusel ${progress.done + (progress.done < progress.total ? 1 : 0)} de ${progress.total}…` : 'Conectando…'}
            </span>
          </div>
          <ProgressBar value={progress && progress.total > 0 ? progress.done / progress.total : null} />
        </Card>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div style={{ padding: '64px 48px', maxWidth: 720, margin: '0 auto' }}>
        <SectionHeader
          kicker="Fase 05 - Carrusel - Prompts"
          title="Sin prompts todavía"
          subtitle={error ?? 'Volvé a la configuración y generá los prompts.'}
          actions={
            <Button variant="primary" size="md" icon={Icon.Wand} onClick={() => void generateAll(false)}>
              Generar prompts
            </Button>
          }
        />
        {error && <ErrorBar msg={error} />}
      </div>
    );
  }

  const ac = Math.min(activeCarousel, list.length - 1);
  const carousel = list[ac];
  const as = Math.min(activeSlide, carousel.slides.length - 1);
  const slide = carousel.slides[as];
  const platformOpt = getPlatformOption(cfg.platform);
  const busy = generating || regenSlideBusy || regenCarouselBusy != null || slideCountBusy;
  const selectedId = carouselSelectedId ?? list[0]?.id ?? null;

  function patchSlide(patch: Partial<CarouselSlide>) {
    projectStore.updateCarouselSlide(carousel.id, slide.index, patch);
  }

  function patchComparison(which: 'bad' | 'good', patch: Partial<CarouselComparisonSide>) {
    const cmp = slide.comparison;
    if (!cmp) return;
    patchSlide({ comparison: { ...cmp, [which]: { ...cmp[which], ...patch } } });
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        kicker={`Fase 05 - Carrusel - Prompts - ${list.length} carrusel${list.length === 1 ? '' : 'es'}`}
        title="Revisá y elegí el carrusel"
        subtitle="Estas son solo las ideas/prompts. Editá lo que quieras y elegí UN carrusel: solo de ese se generarán imágenes. Ajustá también cuántas slides tendrá."
        actions={
          <>
            <Button variant="secondary" size="md" icon={Icon.ArrowL} onClick={() => router.push('/carousel')}>
              Config
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={Icon.Refresh}
              loading={generating}
              disabled={busy}
              onClick={() => void generateAll(true)}
            >
              Regenerar todo
            </Button>
            <Button variant="primary" size="md" icon={Icon.Check} onClick={approve} glow disabled={busy}>
              {carouselPromptsApproved ? 'Aprobado · generar imágenes' : 'Aprobar este y generar imágenes'}
            </Button>
          </>
        }
      />

      {carouselPromptsApproved && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--success-soft)',
            border: '1px solid rgba(43,212,164,0.3)',
            color: 'var(--success)',
            fontSize: 12,
            marginBottom: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.Check size={13} /> Prompts aprobados. Editar o regenerar los desaprobará.
        </div>
      )}

      {error && <ErrorBar msg={error} />}

      {/* Tabs de carruseles — el radio elige cuál se convierte en imágenes */}
      <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 8 }}>
        Elegí el carrusel a generar
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {list.map((c, i) => {
          const isActive = i === ac;
          const isChosen = c.id === selectedId;
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 10,
                background: isActive ? 'var(--blue-soft)' : 'var(--bg-2)',
                border: `1px solid ${isChosen ? 'var(--blue)' : isActive ? 'var(--blue-ring)' : 'var(--line)'}`,
                boxShadow: isChosen ? '0 0 0 2px var(--blue-soft)' : 'none',
                maxWidth: 300,
              }}
            >
              {/* Radio: elige el carrusel para imágenes */}
              <button
                onClick={() => selectCarousel(c.id)}
                title="Generar imágenes de este carrusel"
                aria-label="Elegir este carrusel"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  flexShrink: 0,
                  cursor: 'pointer',
                  background: isChosen ? 'var(--blue)' : 'transparent',
                  border: `2px solid ${isChosen ? 'var(--blue)' : 'var(--line)'}`,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                }}
              >
                {isChosen && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </button>
              {/* Cuerpo: ver/editar este carrusel */}
              <button
                onClick={() => {
                  setActiveCarousel(i);
                  setActiveSlide(0);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  minWidth: 0,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--blue-hi)' : 'var(--fg-3)' }}
                >
                  C{String(c.index).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? 'var(--fg-1)' : 'var(--fg-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.title}
                </span>
                {isChosen && (
                  <Badge tone="blue" size="sm">
                    elegido
                  </Badge>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Lista de slides del carrusel activo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px 8px',
            }}
          >
            <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
              {carousel.slides.length} slides · {platformOpt.aspectRatio}
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={Icon.Refresh}
              loading={regenCarouselBusy === carousel.id}
              disabled={busy}
              onClick={() => void regenCarousel(carousel)}
              title="Regenerar este carrusel completo"
            >
              Carrusel
            </Button>
          </div>

          {/* Stepper: cantidad de slides (imágenes) de este carrusel */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 10,
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
              Cantidad de slides
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StepperBtn
                label="−"
                onClick={() => removeLastSlide(carousel)}
                disabled={busy || carousel.slides.length <= 2}
                title="Quitar la última slide"
              />
              <span
                className="mono"
                style={{ minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}
              >
                {carousel.slides.length}
              </span>
              <StepperBtn
                label="+"
                onClick={() => void addSlide(carousel)}
                disabled={busy || carousel.slides.length >= platformOpt.maxSlides}
                loading={slideCountBusy}
                title="Agregar una slide (genera su prompt)"
              />
            </div>
          </div>
          {carousel.slides.map((s, i) => {
            const isActive = i === as;
            return (
              <button
                key={s.index}
                onClick={() => setActiveSlide(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: isActive ? 'var(--bg-3)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--blue-ring)' : 'transparent'}`,
                  borderRadius: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="mono"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: isActive ? 'var(--blue)' : 'var(--bg-3)',
                    color: isActive ? '#fff' : 'var(--fg-2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {String(s.index).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fg-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.headline || s.suggestedText || `Slide ${s.index}`}
                  </div>
                  <div
                    className="mono upper"
                    style={{
                      fontSize: 10,
                      color: 'var(--fg-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {roleLabel(s.role)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Editor de slide */}
        <Card padding={28} className="anim-in-right" style={{ minHeight: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge tone="blue" size="sm">
                C{String(carousel.index).padStart(2, '0')} · Slide {String(slide.index).padStart(2, '0')}
              </Badge>
              {slide.role === 'cover' && <Badge tone="red" size="sm">PORTADA · HOOK</Badge>}
              {slide.role === 'cta' && <Badge tone="red" size="sm">CIERRE · CTA</Badge>}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={Icon.Refresh}
              loading={regenSlideBusy}
              disabled={busy}
              onClick={() => void regenSlide(carousel, slide)}
            >
              Regenerar slide
            </Button>
          </div>

          {/* ---- COPY EDITORIAL (lo que se lee en el slide) ---- */}
          <Field label="Titular" accent="blue">
            <EditInput value={slide.headline} onChange={(v) => patchSlide({ headline: v })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Palabra resaltada" accent="blue">
              <EditInput
                value={slide.highlightWord ?? ''}
                onChange={(v) => patchSlide({ highlightWord: v })}
              />
            </Field>
            <Field label="Subtítulo" accent="blue">
              <EditInput
                value={slide.subheadline ?? ''}
                onChange={(v) => patchSlide({ subheadline: v })}
              />
            </Field>
          </div>

          <Field label="Cuerpo / caption" accent="blue">
            <EditArea value={slide.body ?? ''} onChange={(v) => patchSlide({ body: v })} rows={2} />
          </Field>

          {slide.role === 'cta' && (
            <Field label="CTA (llamada a la acción)" accent="blue">
              <EditInput value={slide.cta ?? ''} onChange={(v) => patchSlide({ cta: v })} />
            </Field>
          )}

          {/* ---- Comparación malo 👻 / bueno ⭐ ---- */}
          {slide.comparison && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
              }}
            >
              <ComparisonEditor
                title="Malo 👻"
                tone="red"
                side={slide.comparison.bad}
                onChange={(p) => patchComparison('bad', p)}
              />
              <ComparisonEditor
                title="Bueno ⭐"
                tone="blue"
                side={slide.comparison.good}
                onChange={(p) => patchComparison('good', p)}
              />
            </div>
          )}

          {/* ---- Diseño (avanzado) ---- */}
          <div style={{ borderTop: '1px dashed var(--line)', marginTop: 20, paddingTop: 4 }}>
            {flatRefs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                  Referencias — clic para insertar el token en el prompt
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {flatRefs.map((r) => (
                    <button
                      key={r.index}
                      onClick={() =>
                        patchSlide({
                          imagePrompt: `${slide.imagePrompt}${slide.imagePrompt.trim() ? ' ' : ''}@image${r.index}@`,
                        })
                      }
                      title={`Insertar @image${r.index}@ — ${r.nombre}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: 'var(--bg-1)',
                        border: '1px solid var(--line)',
                        cursor: 'pointer',
                        maxWidth: 220,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.url}
                        alt=""
                        style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                      />
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-hi)' }}>
                        @image{r.index}@
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--fg-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0', lineHeight: 1.45 }}>
                  Usá <span className="mono">@image1@</span>, <span className="mono">@image2@</span>… dentro del
                  prompt para decir qué imagen usar en cada slide. Al generar, ese slide recibe solo esas referencias.
                </p>
              </div>
            )}

            <Field label="Prompt de diseño del slide (gpt-image-2)" accent="red">
              <EditArea value={slide.imagePrompt} onChange={(v) => patchSlide({ imagePrompt: v })} rows={5} mono />
            </Field>

            <Field label="Composición" accent="red">
              <EditArea value={slide.composition} onChange={(v) => patchSlide({ composition: v })} rows={2} />
            </Field>

            <Field label="Elementos clave (uno por línea)" accent="red">
              <EditArea
                value={slide.keyElements.join('\n')}
                onChange={(v) =>
                  patchSlide({ keyElements: v.split('\n').map((s) => s.trim()).filter(Boolean) })
                }
                rows={3}
                mono
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <div style={{ flex: 1 }} />
            <Button
              variant="ghost"
              size="sm"
              icon={Icon.ArrowL}
              onClick={() => setActiveSlide(Math.max(0, as - 1))}
              disabled={as === 0}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={Icon.Arrow}
              onClick={() => setActiveSlide(Math.min(carousel.slides.length - 1, as + 1))}
              disabled={as === carousel.slides.length - 1}
            >
              Siguiente
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- subcomponentes ----------
function ErrorBar({ msg }: { msg: string }) {
  return (
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
      {msg}
    </div>
  );
}

function StepperBtn({
  label,
  onClick,
  disabled,
  loading,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'var(--bg-1)' : 'var(--blue-soft)',
        color: disabled ? 'var(--fg-3)' : 'var(--blue-hi)',
        border: `1px solid ${disabled ? 'var(--line)' : 'var(--blue)'}`,
        opacity: disabled ? 0.6 : 1,
        padding: 0,
      }}
    >
      {loading && label === '+' ? <Spinner size={14} color="var(--blue-hi)" /> : label}
    </button>
  );
}

function Field({ label, accent, children }: { label: string; accent: 'blue' | 'red'; children: React.ReactNode }) {
  const c = accent === 'blue' ? 'var(--blue)' : 'var(--red)';
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ComparisonEditor({
  title,
  tone,
  side,
  onChange,
}: {
  title: string;
  tone: 'red' | 'blue';
  side: CarouselComparisonSide;
  onChange: (patch: Partial<CarouselComparisonSide>) => void;
}) {
  const c = tone === 'red' ? 'var(--red-hi)' : 'var(--blue-hi)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="mono upper" style={{ fontSize: 11, fontWeight: 700, color: c }}>
        {title}
      </span>
      <MiniField label="Título">
        <EditInput value={side.label} onChange={(v) => onChange({ label: v })} />
      </MiniField>
      <MiniField label="Caption">
        <EditInput value={side.caption} onChange={(v) => onChange({ caption: v })} />
      </MiniField>
      <MiniField label="Texto sobre la foto">
        <EditInput value={side.overlayText ?? ''} onChange={(v) => onChange({ overlayText: v })} />
      </MiniField>
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="mono upper" style={{ fontSize: 9, color: 'var(--fg-3)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function EditInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 14,
        color: 'var(--fg-1)',
        outline: 'none',
        fontFamily: 'var(--font-body)',
      }}
      onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--blue-ring)')}
      onBlur={(e) => (e.currentTarget.style.border = '1px solid var(--line)')}
    />
  );
}

function EditArea({
  value,
  onChange,
  rows = 3,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: '100%',
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 13,
        color: mono ? 'var(--fg-2)' : 'var(--fg-1)',
        lineHeight: 1.55,
        outline: 'none',
        resize: 'vertical',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
      }}
      onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--blue-ring)')}
      onBlur={(e) => (e.currentTarget.style.border = '1px solid var(--line)')}
    />
  );
}
