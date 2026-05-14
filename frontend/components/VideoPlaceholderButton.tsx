'use client';

export default function VideoPlaceholderButton() {
  function handleClick() {
    // TODO: Fase 6 — integrar generación de video (Remotion / Higgsfield)
  }

  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled
        aria-label="Generar video (próximamente, no disponible aún)"
        aria-disabled="true"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-500 opacity-70"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        Generar video (próximamente)
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-64 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        Esta función estará disponible en la próxima versión. Por ahora puedes exportar el JSON.
      </span>
    </span>
  );
}
