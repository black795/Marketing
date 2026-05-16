'use client';

interface RegenerateToolbarProps {
  selectedCount: number;
  totalCount: number;
  regenerating: boolean;
  error?: string | null;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
}

export default function RegenerateToolbar({
  selectedCount,
  totalCount,
  regenerating,
  error,
  onSelectAll,
  onClearSelection,
  onCancel,
  onRegenerate,
}: RegenerateToolbarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const canRegenerate = selectedCount > 0 && !regenerating;

  return (
    <div className="border-b border-neutral-200 bg-brand-yellow/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-pink text-xs text-white">
              {selectedCount}
            </span>
            {selectedCount === 0
              ? 'Selecciona las imágenes que quieras regenerar'
              : selectedCount === 1
              ? '1 imagen seleccionada'
              : `${selectedCount} imágenes seleccionadas`}
          </span>
          <button
            type="button"
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={regenerating || totalCount === 0}
            className="text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-brand-pink hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allSelected ? 'Quitar selección' : 'Seleccionar todas'}
          </button>
          {error && (
            <span className="text-xs text-red-700">{error}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={regenerating}
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate}
            aria-label={`Regenerar ${selectedCount} imagen${selectedCount === 1 ? '' : 'es'} seleccionada${selectedCount === 1 ? '' : 's'}`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-pink px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-brand-pink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={regenerating ? 'animate-spin' : ''}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {regenerating
              ? 'Regenerando…'
              : `Regenerar ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
