'use client';

import React, { type CSSProperties, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import {
  Badge,
  Button,
  Card,
  CharAvatar,
  FieldGroup,
  IconButton,
  SectionHeader,
} from '../primitives';
import { projectStore, useProject } from '../project-store';
import { generateScript } from '@/lib/api';
import { fetchProfiles, addProfileExample } from '@/lib/profiles';
import { fetchVisualStyles, markVisualStyleUsed } from '@/lib/visual-styles';
import { fetchFavoriteScripts, createFavoriteScript, markFavoriteScriptUsed } from '@/lib/script-library';
import { buildScriptGenerationContext } from '@/lib/script-context';
import SaveProjectButton from '../SaveProjectButton';
import type { Profile } from '@/types/profile';
import type { VisualStyle } from '@/types/visual-style';
import type { FavoriteScript } from '@/types/script-favorite';
import type { Scene } from '@/types/story';

const chipBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 24,
  padding: '0 8px',
  borderRadius: 6,
  background: 'var(--bg-3)',
  border: '1px solid var(--line)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--fg-2)',
  cursor: 'pointer',
  transition: 'all 180ms',
  fontFamily: 'var(--font-mono)',
};

export default function ReviewScreen() {
  const router = useRouter();
  const { script, scriptApproved, form, profileId, scriptAestheticId, scriptStyleId, favoriteScriptIds, scenes: projectScenes } =
    useProject();
  const [active, setActive] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scriptSaved, setScriptSaved] = useState(false);
  const [visualStyles, setVisualStyles] = useState<VisualStyle[]>([]);
  const [favorites, setFavorites] = useState<FavoriteScript[]>([]);
  const [favSaved, setFavSaved] = useState(false);
  const [includeFavImages, setIncludeFavImages] = useState(true);

  // Imágenes de escenas disponibles (para guardarlas con el favorito).
  const favImages = (projectScenes ?? [])
    .map((s) => s.image_url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      return;
    }
    fetchProfiles()
      .then((reg) => setProfile(reg.profiles.find((p) => p.id === profileId) ?? null))
      .catch(() => setProfile(null));
  }, [profileId]);

  useEffect(() => {
    fetchVisualStyles().then((reg) => setVisualStyles(reg.styles)).catch(() => {});
    fetchFavoriteScripts().then((reg) => setFavorites(reg.scripts)).catch(() => {});
  }, []);

  const selectedStyle = visualStyles.find((s) => s.id === scriptStyleId) ?? null;
  const selectedFavorites = favorites.filter((f) => favoriteScriptIds.includes(f.id));

  async function saveScriptToFavorites() {
    if (!script) return;
    const summary = [
      script.style ? `Estilo: ${script.style}` : '',
      script.scenes
        .map((s) => s.narration)
        .filter(Boolean)
        .join(' ')
        .slice(0, 1200),
    ]
      .filter(Boolean)
      .join('\n');
    try {
      const fav = await createFavoriteScript({
        title: script.title,
        style: script.style,
        summary,
        sourcePrompt: form.visualPrompt,
        sceneCount: script.scenes.length,
        images: includeFavImages && favImages.length > 0 ? favImages : undefined,
      });
      setFavorites((prev) => [fav, ...prev]);
      setFavSaved(true);
      setTimeout(() => setFavSaved(false), 1500);
    } catch {
      /* no bloquea el flujo */
    }
  }

  async function saveScriptToProfile() {
    if (!profile || !script) return;
    const summary = [
      script.title ? `Título: ${script.title}` : '',
      script.style ? `Estilo: ${script.style}` : '',
      script.scenes
        .map((s) => s.narration)
        .filter(Boolean)
        .join(' ')
        .slice(0, 600),
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await addProfileExample(profile.id, 'script', summary);
      setScriptSaved(true);
      setTimeout(() => setScriptSaved(false), 1500);
    } catch {
      /* no bloquea el flujo */
    }
  }

  // If user lands here without a script (e.g. refresh on /scripts/review),
  // bounce them back to the prompt.
  useEffect(() => {
    if (script === null) {
      router.replace('/scripts');
    }
  }, [script, router]);

  if (!script) {
    return (
      <div style={{ padding: 48, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        Cargando guion...
      </div>
    );
  }

  const scenes = script.scenes;
  const characters = script.characters ?? [];
  const safeActive = Math.min(active, scenes.length - 1);
  const sc = scenes[safeActive];
  const totalDuration = scenes.reduce((a, s) => a + (s.duration || 0), 0);

  async function regenScript() {
    if (!script || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const refDataUrls = form.references.map((r) => r.dataUrl);
      const { profileContext, styleContext } = buildScriptGenerationContext({
        profile,
        aestheticId: scriptAestheticId,
        savedStyle: selectedStyle,
        favorites: selectedFavorites,
      });
      const next = await generateScript({
        visualPrompt: form.visualPrompt,
        narrativePrompt: form.narrativePrompt || undefined,
        model: form.model,
        referenceImages: refDataUrls.length > 0 ? refDataUrls : undefined,
        sceneCount: form.settings.sceneCount,
        profileContext,
        styleContext,
      });
      if (selectedStyle) markVisualStyleUsed(selectedStyle.id).catch(() => {});
      selectedFavorites.forEach((f) => markFavoriteScriptUsed(f.id).catch(() => {}));
      projectStore.setScript(next);
      setActive(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo regenerar el guion');
    } finally {
      setRegenerating(false);
    }
  }

  function updateScene(patch: Partial<Scene>) {
    if (!script) return;
    const nextScenes = script.scenes.map((s, i) =>
      i === safeActive ? { ...s, ...patch } : s,
    );
    projectStore.setScript({ ...script, scenes: nextScenes });
  }

  function deleteScene() {
    if (!script || scenes.length <= 1) return;
    const nextScenes = scenes.filter((_, i) => i !== safeActive);
    projectStore.setScript({ ...script, scenes: nextScenes });
    setActive(Math.max(0, safeActive - 1));
  }

  function approveAndContinue() {
    projectStore.approveScript();
    router.push('/scripts/scenes');
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        kicker="Fase 02 - Guion"
        title={script.title || 'Sin titulo'}
        subtitle={script.style || form.visualPrompt.slice(0, 140)}
        actions={
          <>
            <SaveProjectButton />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Button
                variant="secondary"
                size="md"
                icon={Icon.Star}
                onClick={saveScriptToFavorites}
                title="Guardar este guion en tu biblioteca de favoritos (reutilizable en cualquier proyecto)"
              >
                {favSaved ? 'En favoritos ✓' : 'Guardar en favoritos'}
              </Button>
              {favImages.length > 0 && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    paddingLeft: 2,
                  }}
                  title="Si lo desmarcás, se guarda solo el texto del guion (más liviano)."
                >
                  <input
                    type="checkbox"
                    checked={includeFavImages}
                    onChange={(e) => setIncludeFavImages(e.target.checked)}
                  />
                  Incluir {favImages.length} {favImages.length === 1 ? 'imagen' : 'imágenes'}
                </label>
              )}
            </div>
            {profile && (
              <Button
                variant="secondary"
                size="md"
                icon={Icon.Save}
                onClick={saveScriptToProfile}
                title={`Guardar este guion como ejemplo del perfil "${profile.name}"`}
              >
                {scriptSaved ? 'Guardado ✓' : `Guardar en ${profile.name}`}
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              icon={Icon.Edit}
              onClick={() => router.push('/scripts')}
            >
              Editar prompt
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={Icon.Refresh}
              loading={regenerating}
              onClick={regenScript}
            >
              Regenerar guion
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Icon.Arrow}
              onClick={approveAndContinue}
              glow
            >
              {scriptApproved ? 'Continuar a imagenes' : 'Aprobar y continuar'}
            </Button>
          </>
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <span className="mono upper" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          Personajes:
        </span>
        {characters.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>
            Sin personajes definidos
          </span>
        ) : (
          characters.map((c, i) => (
            <div
              key={c.name}
              title={c.description}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px 5px 5px',
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                borderRadius: 999,
              }}
            >
              <CharAvatar name={c.name} size={22} hue={200 + i * 40} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{c.name}</span>
            </div>
          ))
        )}
        <button style={{ ...chipBtn, height: 30, borderRadius: 999 }}>
          <Icon.Plus size={12} /> Personaje
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="mono upper"
            style={{ fontSize: 10, color: 'var(--fg-3)', padding: '0 4px 8px' }}
          >
            {scenes.length} escenas - {totalDuration}s total
          </div>
          {scenes.map((s, i) => {
            const isActive = safeActive === i;
            return (
              <button
                key={s.scene_number}
                onClick={() => setActive(i)}
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
                  transition: 'all 180ms',
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
                  {String(s.scene_number).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fg-1)',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.scene_title}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                    {s.duration}s
                  </div>
                </div>
                <Icon.Grip size={14} />
              </button>
            );
          })}
        </div>

        <Card padding={28} className="anim-in-right" style={{ minHeight: 540 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <Badge tone="blue" size="sm">
                  SC - {String(sc.scene_number).padStart(2, '0')}
                </Badge>
                <Badge tone="default" size="sm" icon={Icon.Clock}>
                  {sc.duration}s
                </Badge>
                {sc.block && (
                  <Badge tone={blockTone(sc.block)} size="sm">
                    {blockLabel(sc.block)}
                  </Badge>
                )}
                {sc.shot_type && sc.shot_type !== 'AI' && (
                  <Badge tone="default" size="sm">
                    {sc.shot_type}
                  </Badge>
                )}
              </div>
              <input
                value={sc.scene_title}
                onChange={(e) => updateScene({ scene_title: e.target.value })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--fg-1)',
                  width: '100%',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <IconButton
                icon={Icon.Trash}
                tone="red"
                onClick={deleteScene}
                title="Borrar escena"
              />
            </div>
          </div>

          <FieldGroup letter="A" color="blue" title="Narracion">
            <textarea
              value={sc.narration}
              onChange={(e) => updateScene({ narration: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 6,
                padding: 6,
                fontSize: 14,
                color: 'var(--fg-1)',
                lineHeight: 1.6,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--blue-ring)')}
              onBlur={(e) => (e.currentTarget.style.border = '1px solid transparent')}
            />
          </FieldGroup>

          <FieldGroup letter="B" color="red" title="Image prompt">
            <textarea
              value={sc.image_prompt}
              onChange={(e) => updateScene({ image_prompt: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 6,
                padding: 6,
                fontSize: 13,
                color: 'var(--fg-2)',
                lineHeight: 1.55,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
              }}
              onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--red-ring)')}
              onBlur={(e) => (e.currentTarget.style.border = '1px solid transparent')}
            />
          </FieldGroup>

          <FieldGroup letter="C" color="blue" title="Text overlay (caption)">
            <input
              value={sc.text_overlay ?? ''}
              onChange={(e) => updateScene({ text_overlay: e.target.value })}
              placeholder="3-5 palabras que se ven en pantalla"
              maxLength={48}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 6,
                padding: 6,
                fontSize: 14,
                color: 'var(--fg-1)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--blue-ring)')}
              onBlur={(e) => (e.currentTarget.style.border = '1px solid transparent')}
            />
          </FieldGroup>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginTop: 20,
            }}
          >
            <MetaInput
              label="Camera"
              value={sc.camera}
              onChange={(v) => updateScene({ camera: v })}
            />
            <MetaInput
              label="Lighting"
              value={sc.lighting}
              onChange={(v) => updateScene({ lighting: v })}
            />
            <MetaInput
              label="Emotion"
              value={sc.emotion}
              onChange={(v) => updateScene({ emotion: v })}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            <SelectInput
              label="Block"
              value={sc.block ?? ''}
              onChange={(v) => updateScene({ block: (v || undefined) as Scene['block'] })}
              options={[
                { v: '', label: '—' },
                { v: 'hook', label: 'HOOK' },
                { v: 'pre-cta', label: 'PRE-CTA' },
                { v: 'walkthrough', label: 'WALKTHROUGH' },
                { v: 'transition', label: 'TRANSITION' },
                { v: 'cta', label: 'CTA' },
              ]}
            />
            <SelectInput
              label="Shot type"
              value={sc.shot_type ?? 'AI'}
              onChange={(v) => updateScene({ shot_type: v as Scene['shot_type'] })}
              options={[
                { v: 'AI', label: 'AI' },
                { v: 'SCREEN_REC', label: 'SCREEN REC' },
                { v: 'TEXT', label: 'TEXT' },
                { v: 'VIDEO', label: 'VIDEO' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <div style={{ flex: 1 }} />
            <Button
              variant="ghost"
              size="sm"
              icon={Icon.ArrowL}
              onClick={() => setActive(Math.max(0, safeActive - 1))}
              disabled={safeActive === 0}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={Icon.Arrow}
              onClick={() => setActive(Math.min(scenes.length - 1, safeActive + 1))}
              disabled={safeActive === scenes.length - 1}
            >
              Siguiente
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div
        className="mono upper"
        style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}
      >
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '6px 8px',
          fontSize: 12,
          color: 'var(--fg-1)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div>
      <div
        className="mono upper"
        style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '6px 8px',
          fontSize: 12,
          color: 'var(--fg-1)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function blockLabel(b: NonNullable<Scene['block']>): string {
  switch (b) {
    case 'hook':
      return 'HOOK';
    case 'pre-cta':
      return 'PRE-CTA';
    case 'walkthrough':
      return 'WALKTHROUGH';
    case 'transition':
      return 'TRANSITION';
    case 'cta':
      return 'CTA';
  }
}

function blockTone(b: NonNullable<Scene['block']>): 'red' | 'blue' | 'default' {
  switch (b) {
    case 'hook':
    case 'cta':
      return 'red';
    case 'walkthrough':
      return 'blue';
    case 'pre-cta':
    case 'transition':
      return 'default';
  }
}
