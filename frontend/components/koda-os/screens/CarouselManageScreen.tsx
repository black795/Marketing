'use client';

// Fase Carousel Generator — Gestión final de carruseles.
//
// Muestra todos los carruseles como colecciones de slides. Permite visualizar,
// reordenar (drag/flechas), reemplazar (subir), regenerar slide, regenerar
// carrusel, descargar (ZIP) y un editor rápido (prompt/texto/referencias →
// regenerar solo ese slide). Cache inteligente: si una imagen ya existe para
// el mismo prompt+referencias, se reutiliza. Prepara export para Remotion /
// Captions / Timeline. Todo aditivo: no remueve nada existente.

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, ProgressBar, SectionHeader, Spinner, Textarea } from '../primitives';
import { projectStore, useProject } from '../project-store';
import { streamGenerateCarouselImages } from '@/lib/carousel-images-api';
import { StreamCancelledError } from '@/lib/api';
import { computeImageSig, getCachedImage, setCachedImage } from '@/lib/carousel-image-cache';
import { carouselToTimeline, downloadCarouselZip, downloadJson } from '@/lib/carousel-export';
import { resizeImageToDataUrl, makeImageId } from '@/lib/image-upload';
import { createVisualStyle } from '@/lib/visual-styles';
import {
  CAROUSEL_IMAGE_MODEL,
  CAROUSEL_REFERENCE_LIMITS,
  getPlatformOption,
  type Carousel,
  type CarouselImageResult,
  type CarouselImageTarget,
  type CarouselReference,
  type CarouselSlide,
} from '@/types/carousel';

type SlideStatus = 'idle' | 'active' | 'error';
const QUALITY = 'standard';

function key(carouselId: string, slideIndex: number): string {
  return `${carouselId}:${slideIndex}`;
}

export default function CarouselManageScreen() {
  const router = useRouter();
  const { script, carouselConfig, carouselReferences, carousels } = useProject();

  const list = carousels ?? [];
  const aspectRatio = getPlatformOption(carouselConfig.platform).aspectRatio;
  const projectId = script?.projectId ?? null;

  // Lista plana de referencias (principal primero) con id+url+tipo.
  const allRefs: CarouselReference[] = useMemo(() => {
    const r = carouselReferences;
    const main = r.principal.find((x) => x.id === r.principalId);
    const restP = r.principal.filter((x) => x.id !== r.principalId);
    return [...(main ? [main] : []), ...restP, ...r.secundarias];
  }, [carouselReferences]);

  const [activeCarousel, setActiveCarousel] = useState(0);
  const [statusMap, setStatusMap] = useState<Map<string, SlideStatus>>(new Map());
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ carouselId: string; slideIndex: number } | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [saveStyleOpen, setSaveStyleOpen] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleMsg, setStyleMsg] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<{ carouselId: string; slideIndex: number } | null>(null);

  React.useEffect(() => {
    if (list.length === 0) router.replace('/carousel');
  }, [list.length, router]);
  React.useEffect(() => () => abortRef.current?.abort(), []);

  if (list.length === 0) {
    return <div style={{ padding: 48, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Cargando…</div>;
  }

  const isRunning = !!progress;
  const ac = Math.min(activeCarousel, list.length - 1);
  const carousel = list[ac];

  function setStatus(k: string, s: SlideStatus) {
    setStatusMap((prev) => {
      const next = new Map(prev);
      if (s === 'idle') next.delete(k);
      else next.set(k, s);
      return next;
    });
  }

  // -------- Generación con cache inteligente --------
  async function run(
    targets: CarouselImageTarget[],
    refs: CarouselReference[],
    opts: { force?: boolean } = {},
  ) {
    if (isRunning || targets.length === 0) return;
    setError(null);
    userCancelledRef.current = false;

    const refUrls = refs.map((r) => r.url);
    const refKinds = refs.map((r) => r.tipo);

    // Pre-pass de cache: reutiliza imágenes ya existentes.
    const apiTargets: CarouselImageTarget[] = [];
    for (const t of targets) {
      const sig = computeImageSig(t.prompt, refUrls);
      if (!opts.force) {
        const cached = getCachedImage(sig);
        if (cached) {
          applyResult({
            carouselId: t.carouselId,
            carouselIndex: t.carouselIndex,
            slideIndex: t.slideIndex,
            imageUrl: cached.imageUrl,
            meta: cached.meta,
          });
          continue;
        }
        const slide = list
          .find((c) => c.id === t.carouselId)
          ?.slides.find((s) => s.index === t.slideIndex);
        if (slide?.imageUrl && slide.imageMeta?.prompt === t.prompt) {
          continue; // ya existe con el mismo prompt → reutilizar
        }
      }
      apiTargets.push(t);
    }

    if (apiTargets.length === 0) return; // todo reutilizado

    setProgress({ total: apiTargets.length, done: 0 });
    for (const t of apiTargets) setStatus(key(t.carouselId, t.slideIndex), 'active');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const outcome = await streamGenerateCarouselImages(
        {
          projectId,
          model: CAROUSEL_IMAGE_MODEL,
          quality: QUALITY,
          aspectRatio,
          referenceUrls: refUrls.length > 0 ? refUrls : undefined,
          referenceKinds: refKinds.length > 0 ? refKinds : undefined,
          targets: apiTargets,
        },
        {
          onSlide: (r) => {
            applyResult(r);
            if (r.imageUrl && !r.imageError) {
              setCachedImage(computeImageSig(r.meta?.prompt ?? '', refUrls), {
                imageUrl: r.imageUrl,
                meta: r.meta,
              });
            }
            setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          },
        },
        abort.signal,
      );
      if (outcome.status === 'cancelled') setError('Generación cancelada. Lo completado quedó guardado.');
      else if (outcome.failed > 0) setError(`${outcome.failed} imagen(es) fallaron. Reintentá.`);
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

  function applyResult(r: CarouselImageResult) {
    projectStore.setCarouselSlideImage(r.carouselId, r.slideIndex, {
      imageUrl: r.imageUrl,
      imageError: r.imageError,
      imageMeta: r.meta,
    });
    setStatus(key(r.carouselId, r.slideIndex), r.imageError ? 'error' : 'idle');
  }

  function targetsForCarousel(c: Carousel): CarouselImageTarget[] {
    return c.slides.map((s) => ({ carouselId: c.id, carouselIndex: c.index, slideIndex: s.index, prompt: s.imagePrompt }));
  }

  function regenerateCarousel(c: Carousel) {
    void run(targetsForCarousel(c), allRefs, { force: true });
  }
  function regenerateSlide(c: Carousel, s: CarouselSlide) {
    void run([{ carouselId: c.id, carouselIndex: c.index, slideIndex: s.index, prompt: s.imagePrompt }], allRefs, { force: true });
  }
  function generateMissing() {
    void run(list.flatMap(targetsForCarousel), allRefs, { force: false });
  }

  function cancel() {
    userCancelledRef.current = true;
    abortRef.current?.abort();
  }

  // -------- Reemplazar imagen (subida manual) --------
  function openReplace(c: Carousel, s: CarouselSlide) {
    uploadTargetRef.current = { carouselId: c.id, slideIndex: s.index };
    uploadInputRef.current?.click();
  }
  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = uploadTargetRef.current;
    if (!file || !target) return;
    try {
      const { dataUrl } = await resizeImageToDataUrl(file, CAROUSEL_REFERENCE_LIMITS.maxSidePx);
      projectStore.setCarouselSlideImage(target.carouselId, target.slideIndex, {
        imageUrl: dataUrl,
        imageError: undefined,
        imageMeta: {
          prompt: '(imagen reemplazada manualmente)',
          model: 'manual-upload',
          quality: QUALITY,
          aspectRatio,
          referenceKinds: [],
          referenceCount: 0,
          sourceUrl: null,
          localPath: null,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen');
    }
  }

  // -------- Descargas / export --------
  async function download(c: Carousel) {
    if (zipBusy) return;
    setZipBusy(true);
    try {
      const n = await downloadCarouselZip(c, aspectRatio);
      if (n === 0) setError('Ese carrusel no tiene imágenes generadas para descargar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo armar el ZIP');
    } finally {
      setZipBusy(false);
    }
  }

  // -------- Guardar como estilo visual (captura del carrusel activo) --------
  async function saveStyle() {
    const name = styleName.trim() || carousel.title;
    setSavingStyle(true);
    setStyleMsg(null);
    setError(null);
    try {
      await createVisualStyle({
        name,
        styleNote: carouselConfig.styleNote || carousel.title,
        samplePrompts: carousel.slides.map((s) => s.imagePrompt).filter(Boolean).slice(0, 5),
        references: allRefs.map((r) => ({ tipo: r.tipo, url: r.url, nombre: r.nombre })),
        thumbnail: carousel.slides.find((s) => s.imageUrl)?.imageUrl ?? null,
        source: {
          platform: carouselConfig.platform,
          type: carouselConfig.type,
          objective: carouselConfig.objective,
        },
      });
      setStyleMsg(`Estilo "${name}" guardado en tu biblioteca.`);
      setSaveStyleOpen(false);
      setStyleName('');
      setTimeout(() => setStyleMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estilo');
    } finally {
      setSavingStyle(false);
    }
  }

  const totalSlides = list.reduce((a, c) => a + c.slides.length, 0);
  const doneSlides = list.reduce((a, c) => a + c.slides.filter((s) => s.imageUrl).length, 0);

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onUploadFile}
        style={{ display: 'none' }}
      />

      <SectionHeader
        kicker={`Fase 05 - Carrusel - Gestión - ${doneSlides}/${totalSlides} imágenes`}
        title="Tus carruseles"
        subtitle="Visualizá, reordená, reemplazá o regenerá slides. Descargá cada carrusel o exportalo para edición."
        actions={
          isRunning ? (
            <Button variant="danger" size="md" icon={Icon.X} onClick={cancel}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="md" icon={Icon.Image} onClick={() => router.push('/carousel/images')}>
                Imágenes
              </Button>
              <Button variant="secondary" size="md" icon={Icon.Sparkles} onClick={generateMissing} disabled={doneSlides === totalSlides}>
                Generar faltantes
              </Button>
              <Button variant="secondary" size="md" icon={Icon.Save} onClick={() => setSaveStyleOpen((v) => !v)}>
                Guardar estilo
              </Button>
              <Button variant="primary" size="md" icon={Icon.Arrow} onClick={() => router.push('/styles')} glow>
                Continuar a estilo
              </Button>
            </>
          )
        }
      />

      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red-ring)', color: 'var(--red-hi)', fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {styleMsg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--success-soft)', border: '1px solid rgba(43,212,164,0.3)', color: 'var(--success)', fontSize: 12, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon.Check size={13} /> {styleMsg}
        </div>
      )}

      {saveStyleOpen && (
        <Card padding={16} accent="blue" style={{ marginBottom: 16 }}>
          <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 8 }}>
            Guardar estilo desde “{carousel.title}”
          </div>
          <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 10px', lineHeight: 1.5 }}>
            Captura la descripción de estilo, {carousel.slides.length} prompts de muestra, {allRefs.length} referencia(s) y una
            imagen de thumbnail. Después lo seleccionás en la config de cualquier carrusel para que lo imite.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              placeholder={`Nombre del estilo (ej: ${carousel.title.slice(0, 24)})`}
              style={{ flex: 1, minWidth: 220, height: 36, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 10px', fontSize: 13, color: 'var(--fg-1)', outline: 'none' }}
            />
            <Button variant="primary" size="md" icon={Icon.Save} loading={savingStyle} onClick={() => void saveStyle()} glow>
              Guardar en biblioteca
            </Button>
            <Button variant="ghost" size="md" onClick={() => setSaveStyleOpen(false)} disabled={savingStyle}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {list.map((c, i) => {
          const isActive = i === ac;
          const cDone = c.slides.filter((s) => s.imageUrl).length;
          return (
            <button
              key={c.id}
              onClick={() => {
                setActiveCarousel(i);
                setEditing(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                background: isActive ? 'var(--blue-soft)' : 'var(--bg-2)',
                border: `1px solid ${isActive ? 'var(--blue)' : 'var(--line)'}`,
                cursor: 'pointer',
                maxWidth: 280,
              }}
            >
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--blue-hi)' : 'var(--fg-3)' }}>
                C{String(c.index).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--fg-1)' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title}
              </span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{cDone}/{c.slides.length}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar del carrusel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {carousel.title} · {carousel.slides.length} slides · {aspectRatio}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" icon={Icon.Refresh} onClick={() => regenerateCarousel(carousel)} disabled={isRunning}>
            Regenerar carrusel
          </Button>
          <Button variant="secondary" size="sm" icon={Icon.Download} loading={zipBusy} onClick={() => void download(carousel)}>
            Descargar ZIP
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Icon.Film}
            onClick={() => downloadJson(carouselToTimeline(carousel, aspectRatio), `${carousel.title}-timeline`)}
            title="Exportar para Remotion / Captions / Timeline (JSON)"
          >
            Exportar edición
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 360px' : '1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Grid de slides (reordenable) */}
        <SlideGrid
          carousel={carousel}
          aspectRatio={aspectRatio}
          statusMap={statusMap}
          disabled={isRunning}
          activeEditing={editing}
          onReorder={(from, to) => projectStore.reorderCarouselSlides(carousel.id, from, to)}
          onRegenerate={(s) => regenerateSlide(carousel, s)}
          onReplace={(s) => openReplace(carousel, s)}
          onEdit={(s) => setEditing({ carouselId: carousel.id, slideIndex: s.index })}
        />

        {/* Editor rápido */}
        {editing && editing.carouselId === carousel.id && (
          <QuickEditor
            carousel={carousel}
            slideIndex={editing.slideIndex}
            allRefs={allRefs}
            disabled={isRunning}
            onClose={() => setEditing(null)}
            onSaveAndRegen={(payload, refs) =>
              run([{ carouselId: carousel.id, carouselIndex: carousel.index, slideIndex: payload.slideIndex, prompt: payload.imagePrompt }], refs, { force: true })
            }
          />
        )}
      </div>

      {/* Integraciones futuras */}
      <Card padding={16} accent="blue" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="blue" icon={Icon.Sparkles} size="sm">integraciones</Badge>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
            El export de edición ya usa el formato del Timeline (clips + captions). Listo para conectar a:
          </span>
          <Badge tone="default" size="sm">Remotion</Badge>
          <Badge tone="default" size="sm">Captions</Badge>
          <Badge tone="default" size="sm">Editor Timeline</Badge>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· próximamente (cableado)</span>
        </div>
      </Card>
    </div>
  );
}

// =====================================================================
// Grid de slides reordenable
// =====================================================================
function SlideGrid({
  carousel,
  aspectRatio,
  statusMap,
  disabled,
  activeEditing,
  onReorder,
  onRegenerate,
  onReplace,
  onEdit,
}: {
  carousel: Carousel;
  aspectRatio: string;
  statusMap: Map<string, SlideStatus>;
  disabled: boolean;
  activeEditing: { carouselId: string; slideIndex: number } | null;
  onReorder: (from: number, to: number) => void;
  onRegenerate: (s: CarouselSlide) => void;
  onReplace: (s: CarouselSlide) => void;
  onEdit: (s: CarouselSlide) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const ratio = aspectRatio.replace(':', ' / ');

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      {carousel.slides.map((s, i) => {
        const st = statusMap.get(key(carousel.id, s.index));
        const isActive = st === 'active';
        const isError = st === 'error' || !!s.imageError;
        const isEditing = activeEditing?.carouselId === carousel.id && activeEditing.slideIndex === s.index;
        return (
          <li
            key={s.index}
            draggable={!disabled}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx != null && dragIdx !== i) onReorder(dragIdx, i);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--bg-2)',
              border: `1.5px solid ${isEditing ? 'var(--blue)' : isError ? 'var(--red-ring)' : 'var(--line)'}`,
              boxShadow: isEditing ? '0 0 0 3px var(--blue-soft)' : 'var(--shadow-sm)',
              opacity: dragIdx === i ? 0.5 : 1,
              cursor: disabled ? 'default' : 'grab',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: ratio, background: 'var(--bg-3)' }}>
              {s.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={s.imageUrl} alt={s.suggestedText} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className={isActive ? '' : 'skeleton'} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                  {isActive ? (
                    <Spinner size={20} color="var(--blue-hi)" />
                  ) : (
                    <span className="mono upper" style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: 1 }}>sin imagen</span>
                  )}
                </div>
              )}
              {isActive && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,8,11,0.45)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(2px)' }}>
                  <Spinner size={22} color="#fff" />
                </div>
              )}
              <span className="mono" style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(7,8,11,0.78)', color: '#fff', fontSize: 10, fontWeight: 700, backdropFilter: 'blur(6px)' }}>
                #{String(s.index).padStart(2, '0')}
              </span>
            </div>

            <div style={{ padding: '8px 10px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.suggestedText}>
                {s.suggestedText || `Slide ${s.index}`}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <MiniBtn icon={Icon.Edit} label="Editar" onClick={() => onEdit(s)} disabled={disabled} />
                <MiniBtn icon={Icon.Refresh} label="Regenerar" onClick={() => onRegenerate(s)} disabled={disabled || isActive} />
                <MiniBtn icon={Icon.Upload} label="Reemplazar" onClick={() => onReplace(s)} disabled={disabled} />
                <span style={{ flex: 1 }} />
                <MoveBtn dir="‹" disabled={disabled || i === 0} onClick={() => onReorder(i, i - 1)} />
                <MoveBtn dir="›" disabled={disabled || i === carousel.slides.length - 1} onClick={() => onReorder(i, i + 1)} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MiniBtn({ icon: I, label, onClick, disabled }: { icon: typeof Icon.Edit; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        width: 28,
        height: 26,
        borderRadius: 6,
        border: '1px solid var(--line)',
        background: 'var(--bg-1)',
        color: 'var(--fg-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <I size={13} />
    </button>
  );
}

function MoveBtn({ dir, disabled, onClick }: { dir: '‹' | '›'; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === '‹' ? 'Mover antes' : 'Mover después'}
      style={{ width: 24, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-2)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1, fontSize: 13, lineHeight: 1 }}
    >
      {dir}
    </button>
  );
}

// =====================================================================
// Editor rápido (prompt / texto / referencias → regenerar este slide)
// =====================================================================
function QuickEditor({
  carousel,
  slideIndex,
  allRefs,
  disabled,
  onClose,
  onSaveAndRegen,
}: {
  carousel: Carousel;
  slideIndex: number;
  allRefs: CarouselReference[];
  disabled: boolean;
  onClose: () => void;
  onSaveAndRegen: (payload: { slideIndex: number; imagePrompt: string }, refs: CarouselReference[]) => void;
}) {
  const slide = carousel.slides.find((s) => s.index === slideIndex);
  const [text, setText] = useState(slide?.suggestedText ?? '');
  const [prompt, setPrompt] = useState(slide?.imagePrompt ?? '');
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(() => new Set(allRefs.map((r) => r.id)));

  // Re-sincroniza al cambiar de slide.
  React.useEffect(() => {
    setText(slide?.suggestedText ?? '');
    setPrompt(slide?.imagePrompt ?? '');
    setSelectedRefs(new Set(allRefs.map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, carousel.id]);

  if (!slide) return null;

  function persist() {
    projectStore.updateCarouselSlide(carousel.id, slideIndex, { suggestedText: text, imagePrompt: prompt });
  }

  function save() {
    persist();
    onClose();
  }

  function saveAndRegen() {
    persist();
    const refs = allRefs.filter((r) => selectedRefs.has(r.id));
    onSaveAndRegen({ slideIndex, imagePrompt: prompt }, refs);
  }

  function toggleRef(id: string) {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card padding={18} style={{ position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Badge tone="blue" size="sm">Editor · Slide {String(slideIndex).padStart(2, '0')}</Badge>
        <button onClick={onClose} aria-label="Cerrar editor" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer' }}>
          <Icon.X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Textarea label="Texto" value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <Textarea label="Prompt GPT Image 2" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} />

        <div>
          <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 6 }}>
            Referencias ({selectedRefs.size}/{allRefs.length})
          </div>
          {allRefs.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>Sin referencias cargadas.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allRefs.map((r) => {
                const on = selectedRefs.has(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRef(r.id)}
                    title={`${r.tipo} · ${r.nombre}`}
                    style={{
                      position: 'relative',
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: `2px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
                      opacity: on ? 1 : 0.45,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={r.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button variant="secondary" size="sm" icon={Icon.Save} onClick={save} disabled={disabled} style={{ flex: 1 }}>
            Guardar
          </Button>
          <Button variant="primary" size="sm" icon={Icon.Refresh} onClick={saveAndRegen} disabled={disabled} glow style={{ flex: 1 }}>
            Guardar y regenerar
          </Button>
        </div>
      </div>
    </Card>
  );
}
