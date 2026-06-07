'use client';

// Fase - Carousel Generator.
//
// Va DESPUÉS de la generación del contenido principal (storyboard / video) y
// ANTES de la fase de edición (styles). Toma el guion/escenas ya generados y
// deja al usuario configurar uno o varios carruseles:
//   1. Cantidad de carruseles (1 / 2 / 3 / 5 / 10)
//   2. Tipo (educativo, venta, branding, storytelling, comparativo,
//      antes-después, caso de éxito)
//   3. Objetivo (alcance, engagement, conversión, leads, ventas)
//   4. Plataforma (Instagram, LinkedIn, Facebook, TikTok Slides)
//
// La config se persiste en el project-store. "Generar prompts" lleva a la
// pantalla de revisión (/carousel/review) donde Claude arma los prompts de
// cada slide para aprobarlos. Las imágenes NO se generan todavía.
// Toda la pantalla reutiliza los primitives de Koda OS.

import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { Badge, Button, Card, SectionHeader, Textarea } from '../primitives';
import { projectStore, useProject, type ReferenceImage } from '../project-store';
import { MentionTextarea } from '../MentionTextarea';
import CarouselReferenceManager from '../../carousel/CarouselReferenceManager';
import StylePicker from '../../carousel/StylePicker';
import AestheticPicker from '../AestheticPicker';
import { markVisualStyleUsed } from '@/lib/visual-styles';
import { makeImageId } from '@/lib/image-upload';
import type { VisualStyle } from '@/types/visual-style';
import {
  CAROUSEL_COUNT_MIN,
  CAROUSEL_COUNT_MAX,
  clampCarouselCount,
  CAROUSEL_TYPES,
  CAROUSEL_OBJECTIVES,
  CAROUSEL_PLATFORMS,
  clampSlides,
  flattenCarouselReferences,
  getPlatformOption,
  getTypeOption,
  type CarouselCount,
  type CarouselObjective,
  type CarouselPlatform,
  type CarouselType,
  type CarouselReference,
} from '@/types/carousel';

export default function CarouselScreen() {
  const router = useRouter();
  const { scenes, carouselConfig, carouselReferences, carouselStyleId } = useProject();

  // Modo standalone: el carrusel funciona sin guion previo. Su brief, estilo y
  // referencias se cargan acá; las imágenes del proyecto (scenes) son un extra
  // opcional. Por eso NO hay guard que exija un script generado.

  const cfg = carouselConfig;
  const platformOpt = getPlatformOption(cfg.platform);
  const typeOpt = getTypeOption(cfg.type);
  const sourceImages = (scenes ?? []).filter((s) => s.image_url);

  // Referencias del carrusel mapeadas para el autocompletado @imagenN. El orden
  // es el MISMO con el que se mandan al modelo (producto principal → resto →
  // secundarias), así @imagen1 = la imagen #1 real.
  const mentionRefs: ReferenceImage[] = flattenCarouselReferences(carouselReferences).map((r) => ({
    id: `cref-${r.index}`,
    dataUrl: r.url,
    name: r.nombre ? `${r.label} · ${r.nombre}` : r.label,
  }));

  function pickCount(count: CarouselCount) {
    projectStore.setCarouselConfig({ count: clampCarouselCount(count) });
  }

  function pickType(type: CarouselType) {
    const next = getTypeOption(type);
    projectStore.setCarouselConfig({
      type,
      slidesPerCarousel: clampSlides(next.defaultSlides, cfg.platform),
    });
  }

  function pickObjective(objective: CarouselObjective) {
    projectStore.setCarouselConfig({ objective });
  }

  function pickPlatform(platform: CarouselPlatform) {
    projectStore.setCarouselConfig({
      platform,
      slidesPerCarousel: clampSlides(cfg.slidesPerCarousel, platform),
    });
  }

  const canGenerate = cfg.productBrief.trim().length > 0;

  function applyStyle(style: VisualStyle) {
    // Imita el estilo: su descripción va al styleNote y sus referencias se
    // precargan como secundarias (las que el motor mandará a GPT Image 2).
    projectStore.setCarouselConfig({ styleNote: style.styleNote || cfg.styleNote });
    projectStore.setCarouselStyleId(style.id);

    const existingUrls = new Set(
      [...carouselReferences.principal, ...carouselReferences.secundarias].map((r) => r.url),
    );
    const add: CarouselReference[] = style.references
      .filter((r) => !existingUrls.has(r.url))
      .map((r) => ({
        id: makeImageId('cref'),
        url: r.url,
        tipo: r.tipo,
        nombre: r.nombre ?? `estilo:${style.name}`,
        fecha: new Date().toISOString(),
      }));
    if (add.length > 0) {
      projectStore.setCarouselReferences({
        ...carouselReferences,
        secundarias: [...carouselReferences.secundarias, ...add],
      });
    }
    void markVisualStyleUsed(style.id).catch(() => {});
  }

  function goToReview() {
    router.push('/carousel/review');
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 05 - Carousel Generator"
        title="Convierte el contenido en carruseles"
        subtitle="Define cuántos carruseles querés, su tipo, objetivo y plataforma. La generación de slides es el siguiente paso; acá dejás todo configurado."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={Icon.ArrowL}
              onClick={() => router.push('/storyboard')}
            >
              Volver a video
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Icon.Wand}
              onClick={goToReview}
              disabled={!canGenerate}
              glow
              title={canGenerate ? undefined : 'Describí el producto/tema primero'}
            >
              Generar prompts
            </Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'flex-start' }}>
        {/* ---------- Columna de selectores ---------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. Producto y estilo */}
          <FieldBlock
            n="01"
            title="Producto y estilo"
            hint="Describí el sujeto del carrusel. El estilo es opcional."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MentionField
                label="Producto / tema"
                placeholder="Ej: campaña para *Nike de zapatillas running. Usá @imagen1 como producto principal."
                value={cfg.productBrief}
                onChange={(v) => projectStore.setCarouselConfig({ productBrief: v })}
                references={mentionRefs}
                rows={3}
              />
              <MentionField
                label="Estilo visual (opcional)"
                placeholder="Ej: editorial bright, luz natural, paleta de *Spotify, fondo neutro."
                value={cfg.styleNote}
                onChange={(v) => projectStore.setCarouselConfig({ styleNote: v })}
                references={mentionRefs}
                rows={2}
              />
              <MentionHint hasRefs={mentionRefs.length > 0} />
              <Textarea
                label="Handle / @usuario (opcional)"
                placeholder="Ej: @alanlazarga — se renderiza al pie de cada slide."
                value={cfg.handle ?? ''}
                onChange={(e) => projectStore.setCarouselConfig({ handle: e.target.value })}
                rows={1}
              />
              <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 8 }}>
                  Estética
                </div>
                <AestheticPicker
                  selectedId={cfg.aestheticId}
                  onSelect={(id) => projectStore.setCarouselConfig({ aestheticId: id })}
                  compact
                />
              </div>
              <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                <StylePicker
                  selectedId={carouselStyleId}
                  onApply={applyStyle}
                  onClear={() => projectStore.setCarouselStyleId(null)}
                />
              </div>
            </div>
          </FieldBlock>

          {/* 2. Cantidad */}
          <FieldBlock
            n="02"
            title="Cantidad de carruseles"
            hint="Cuántas piezas independientes vas a generar."
          >
            <CountSlider value={cfg.count} onChange={pickCount} />
          </FieldBlock>

          {/* 3. Tipo */}
          <FieldBlock n="03" title="Tipo de carrusel" hint="Define la estructura narrativa.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {CAROUSEL_TYPES.map((t) => (
                <OptionCard
                  key={t.id}
                  selected={cfg.type === t.id}
                  title={t.label}
                  description={t.description}
                  tag={`${t.defaultSlides} slides`}
                  onClick={() => pickType(t.id)}
                />
              ))}
            </div>
          </FieldBlock>

          {/* 4. Objetivo */}
          <FieldBlock n="04" title="Objetivo" hint="Hacia qué métrica optimizar el copy y el CTA.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {CAROUSEL_OBJECTIVES.map((o) => (
                <OptionCard
                  key={o.id}
                  selected={cfg.objective === o.id}
                  title={o.label}
                  description={o.description}
                  onClick={() => pickObjective(o.id)}
                />
              ))}
            </div>
          </FieldBlock>

          {/* 5. Plataforma */}
          <FieldBlock n="05" title="Plataforma" hint="Define relación de aspecto y límite de slides.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {CAROUSEL_PLATFORMS.map((p) => (
                <OptionCard
                  key={p.id}
                  selected={cfg.platform === p.id}
                  title={p.label}
                  description={`Recomendado ${p.recommendedSlides[0]}-${p.recommendedSlides[1]} slides · máx ${p.maxSlides}`}
                  tag={p.aspectRatio}
                  onClick={() => pickPlatform(p.id)}
                />
              ))}
            </div>
          </FieldBlock>

          {/* 6. Referencias visuales */}
          <FieldBlock
            n="06"
            title="Referencias visuales"
            hint="Producto + logos, branding, ejemplos, capturas y mockups. Se enviarán a GPT Image 2 como referencia."
          >
            <CarouselReferenceManager
              value={carouselReferences}
              onChange={(next) => projectStore.setCarouselReferences(next)}
            />
          </FieldBlock>
        </div>

        {/* ---------- Sidebar resumen ---------- */}
        <div style={{ position: 'sticky', top: 24, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={18}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}>
              Resumen de la config
            </div>
            <SummaryRow label="Carruseles" value={String(cfg.count)} />
            <SummaryRow label="Tipo" value={typeOpt.label} />
            <SummaryRow label="Objetivo" value={cfg.objective} />
            <SummaryRow label="Plataforma" value={platformOpt.label} />
            <SummaryRow label="Aspect ratio" value={platformOpt.aspectRatio} />
            <SummaryRow label="Slides/carrusel" value={String(cfg.slidesPerCarousel)} />
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px dashed var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--fg-3)' }}>total slides</span>
              <span style={{ color: 'var(--blue-hi)', fontWeight: 700 }}>
                {cfg.count * cfg.slidesPerCarousel}
              </span>
            </div>
          </Card>

          <Card padding={18}>
            <div className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 10 }}>
              Referencias
            </div>
            <SummaryRow
              label="Producto"
              value={`${carouselReferences.principal.length}${carouselReferences.principalId ? ' · 1 principal' : ''}`}
            />
            <SummaryRow label="Secundarias" value={String(carouselReferences.secundarias.length)} />
            <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {sourceImages.length > 0
                ? `${sourceImages.length} imágenes del proyecto disponibles como base.`
                : 'Sin imágenes de origen — se usarán solo las referencias.'}
            </p>
          </Card>

          {/* Generación de prompts → pantalla de revisión */}
          <Card padding={18} accent="blue">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Badge tone="blue" icon={Icon.Sparkles} size="sm">
                siguiente: revisar
              </Badge>
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Claude arma los prompts de cada slide para que los revises y apruebes.
              Las imágenes se generan en una etapa posterior.
            </p>
            <Button
              variant="primary"
              size="md"
              icon={Icon.Wand}
              onClick={goToReview}
              disabled={!canGenerate}
              glow
              style={{ width: '100%' }}
            >
              Generar prompts
            </Button>
            {!canGenerate && (
              <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 0' }}>
                Describí el producto/tema en el bloque 01 para continuar.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- Campo con menciones @imagenN ----------
function MentionField({
  label,
  placeholder,
  value,
  onChange,
  references,
  rows,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  references: ReferenceImage[];
  rows: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>{label}</label>
      <MentionTextarea
        value={value}
        onChange={onChange}
        references={references}
        rows={rows}
        ariaLabel={label}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------- Ayuda: @imagen y *empresa ----------
function MentionHint({ hasRefs }: { hasRefs: boolean }) {
  return (
    <p
      style={{
        margin: '2px 0 0',
        fontSize: 11,
        lineHeight: 1.55,
        color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <code style={{ color: 'var(--blue-hi)' }}>@imagen1</code>{' '}
      {hasRefs ? 'menciona una referencia' : '(subí referencias abajo para mencionarlas)'} ·{' '}
      <code style={{ color: 'var(--blue-hi)' }}>*Nike</code> busca la empresa en internet (usá{' '}
      <code style={{ color: 'var(--blue-hi)' }}>*&quot;Coca Cola&quot;</code> si tiene espacios).
    </p>
  );
}

// ---------- Field block (numerado) ----------
function FieldBlock({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--blue-hi)',
            background: 'var(--blue-soft)',
            border: '1px solid var(--blue-ring)',
            borderRadius: 6,
            padding: '2px 6px',
          }}
        >
          {n}
        </span>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          {hint && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

// ---------- Slider (cantidad) ----------
function CountSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const min = CAROUSEL_COUNT_MIN;
  const max = CAROUSEL_COUNT_MAX;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Cantidad de carruseles"
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right, var(--blue) 0%, var(--blue) ${pct}%, var(--bg-1) ${pct}%, var(--bg-1) 100%)`,
            outline: 'none',
          }}
        />
        <div
          style={{
            minWidth: 56,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: 'var(--blue-soft)',
            color: 'var(--blue-hi)',
            border: '1.5px solid var(--blue)',
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
        }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--blue-hi);
          border: 3px solid var(--bg-0, #fff);
          box-shadow: 0 0 0 1.5px var(--blue);
          cursor: pointer;
          transition: transform 120ms var(--ease-out);
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.12);
        }
        input[type=range]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--blue-hi);
          border: 3px solid var(--bg-0, #fff);
          box-shadow: 0 0 0 1.5px var(--blue);
          cursor: pointer;
        }
      `,
        }}
      />
    </div>
  );
}

// ---------- Option card (tipo / objetivo / plataforma) ----------
function OptionCard({
  selected,
  title,
  description,
  tag,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  tag?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: 12,
        borderRadius: 12,
        cursor: 'pointer',
        background: selected ? 'var(--blue-soft)' : 'var(--bg-1)',
        border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--line)'}`,
        boxShadow: selected ? '0 0 0 3px var(--blue-soft)' : 'none',
        transition: 'all 180ms var(--ease-out)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: selected ? 'var(--blue-hi)' : 'var(--fg-1)' }}>
          {title}
        </span>
        {tag && (
          <Badge tone={selected ? 'blue' : 'default'} size="sm">
            {tag}
          </Badge>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.45 }}>{description}</p>
      {selected && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 18,
            height: 18,
            borderRadius: 99,
            background: 'var(--blue)',
            color: '#fff',
            display: tag ? 'none' : 'grid',
            placeItems: 'center',
          }}
        >
          <Icon.Check size={11} />
        </span>
      )}
    </button>
  );
}

// ---------- Summary row ----------
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ color: 'var(--fg-1)', fontWeight: 600, textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
