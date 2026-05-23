'use client';

import { EDITORS, type EditorAdapterInfo } from '@/lib/editor-adapters';

interface EditorPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

/**
 * Grid de cards para elegir editor. Los editores no implementados se ven
 * (para mostrar el catálogo) pero están deshabilitados con badge claro.
 */
export default function EditorPicker({
  selectedId,
  onSelect,
  disabled = false,
}: EditorPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {EDITORS.map((e) => {
        const active = e.info.id === selectedId;
        const canClick = e.info.implemented && !disabled;
        return (
          <button
            key={e.info.id}
            type="button"
            disabled={!canClick}
            onClick={() => canClick && onSelect(e.info.id)}
            aria-pressed={active}
            className={`group relative flex flex-col items-start gap-2 rounded-xl border-2 bg-white p-4 text-left transition disabled:cursor-not-allowed ${
              active
                ? 'border-brand-pink shadow-[0_4px_20px_rgba(255,45,138,0.15)]'
                : e.info.implemented
                ? 'border-neutral-200 hover:border-brand-pink/60 hover:shadow-sm'
                : 'border-neutral-200 opacity-60'
            }`}
          >
            <header className="flex w-full items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-lg">
                {e.info.emoji}
              </span>
              {e.info.badge && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    e.info.badge === 'Recomendado'
                      ? 'bg-brand-pink text-white'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {e.info.badge}
                </span>
              )}
            </header>
            <h3 className="text-sm font-bold text-neutral-900">{e.info.label}</h3>
            <p className="text-xs leading-relaxed text-neutral-500">
              {e.info.description}
            </p>
            <CapabilityRow caps={e.info.capabilities} />
            {active && (
              <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-[10px] font-bold text-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CapabilityRow({ caps }: { caps: EditorAdapterInfo['capabilities'] }) {
  const items: { label: string; on: boolean }[] = [
    { label: 'Subt.', on: caps.captions },
    { label: 'Audio', on: caps.audio },
    { label: 'Trans.', on: caps.transitions },
    { label: 'Layout', on: caps.customLayout },
  ];
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((i) => (
        <span
          key={i.label}
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            i.on
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-neutral-100 text-neutral-400'
          }`}
        >
          <span className="inline-block h-1 w-1 rounded-full bg-current" />
          {i.label}
        </span>
      ))}
    </div>
  );
}
