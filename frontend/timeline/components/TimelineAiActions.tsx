'use client';

import { useState } from 'react';
import { useStoryboard } from '@/storyboard';
import {
  AUTO_EDIT_PRESETS,
  CAPTION_STYLES,
  applyCaptionStyle,
  getCaptionStyle,
  type AutoEditPreset,
} from '@/editing/engine';
import { runAutoEditWithVersioning } from '@/storyboard/utils/auto-edit-apply';
import { recalcFrames } from '@/editing';
import { useTimelineUi } from '../store/context';

/**
 * Acciones IA del timeline. Cuatro funciones expuestas:
 *
 *   1. Aplicar preset (todo el proyecto / sólo seleccionadas).
 *   2. Auto-sync captions (re-aplica el caption style actual con timing fresco).
 *   3. Edit by prompt — caja libre; mapea keywords a presets.
 *   4. Regenerar escena (placeholder de wiring; el backend de regen IA
 *      no existe aún — la acción marca la escena como 'building' para que
 *      el operador sepa lo que va a pasar).
 */
export default function TimelineAiActions() {
  const { state: sb, dispatch: dispatchSb } = useStoryboard();
  const { ui } = useTimelineUi();
  const [promptDraft, setPromptDraft] = useState('');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  function applyPreset(preset: AutoEditPreset) {
    const onlySceneId = ui.selection.length === 1 ? ui.selection[0] : undefined;
    const { project, report } = runAutoEditWithVersioning(sb.project, preset.config, {
      onlySceneId,
      label: `${preset.emoji} ${preset.label}`,
    });
    dispatchSb({ type: 'APPLY_PROJECT', project });
    setLastMessage(
      `${preset.emoji} ${preset.label} aplicado · ${report.scenesProcessed} escena${report.scenesProcessed === 1 ? '' : 's'}`
    );
  }

  function autoSyncCaptions() {
    const scenes = sb.project.scenes.map((s) => {
      if (s.captions.length === 0) return s;
      const styleId = s.captions[0].style;
      const style = getCaptionStyle(styleId);
      return { ...s, captions: applyCaptionStyle(s, { style }) };
    });
    dispatchSb({
      type: 'APPLY_PROJECT',
      project: { ...sb.project, scenes: recalcFrames(scenes) },
    });
    setLastMessage('🔄 Captions re-sincronizados con el word-timing actual.');
  }

  function interpretPrompt() {
    const text = promptDraft.trim().toLowerCase();
    if (!text) return;

    // Mapeo de keywords → preset.
    let pickedId: string | null = null;
    if (/tiktok|viral|fast|r[aá]pid/.test(text)) pickedId = 'tiktok-viral';
    else if (/hormozi|cash|money|negocio/.test(text)) pickedId = 'hormozi-style';
    else if (/cinemat|film/.test(text)) pickedId = 'cinematic';
    else if (/podcast|talking|talkinghead|talk[- ]?head/.test(text)) pickedId = 'podcast-clip';
    else if (/documental|doc/.test(text)) pickedId = 'documentary';

    if (pickedId) {
      const preset = AUTO_EDIT_PRESETS.find((p) => p.id === pickedId)!;
      applyPreset(preset);
      return;
    }

    // Fallback: si menciona "captions/subtítulos", solo re-sync captions.
    if (/caption|subt[ií]tul/.test(text)) {
      autoSyncCaptions();
      return;
    }

    setLastMessage(
      'No reconocí ningún preset. Prueba "viral", "cinemático", "podcast" o "documental".'
    );
  }

  function regenerateSelected() {
    if (ui.selection.length === 0) return;
    for (const sceneId of ui.selection) {
      dispatchSb({ type: 'SET_SCENE_STATUS', sceneId, status: 'building' });
    }
    setLastMessage(
      `🪄 ${ui.selection.length} escena(s) marcadas como 'generando'. (El backend de regen entra en próxima fase.)`
    );
  }

  return (
    <div className="space-y-2 border-t border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          IA Actions
        </p>
        {ui.selection.length > 0 && (
          <span className="rounded bg-brand-pink/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-pink">
            sobre {ui.selection.length} escena{ui.selection.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Prompt libre */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') interpretPrompt();
          }}
          placeholder='Edita por prompt — ej. "hazlo más TikTok", "cinemático", "podcast"…'
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        <button
          type="button"
          onClick={interpretPrompt}
          disabled={promptDraft.trim().length === 0}
          className="rounded-md bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-600 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>

      {/* Chips de presets */}
      <div className="flex flex-wrap gap-1">
        {AUTO_EDIT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
            title={p.description}
          >
            <span>{p.emoji}</span>
            <span>{p.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={autoSyncCaptions}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink"
        >
          🔄 Sync captions
        </button>
        <button
          type="button"
          onClick={regenerateSelected}
          disabled={ui.selection.length === 0}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:border-brand-pink hover:text-brand-pink disabled:opacity-40"
        >
          🪄 Regenerar
        </button>
      </div>

      {lastMessage && (
        <p className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
          {lastMessage}
        </p>
      )}
    </div>
  );
}
