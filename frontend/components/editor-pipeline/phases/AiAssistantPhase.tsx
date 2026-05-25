'use client';

/**
 * Fase 7 — IA Editing Assistant. Placeholder visible para Ola 3.
 *
 * En Ola 3 va a hacer:
 *  - sugerir transiciones / cortes / pacing
 *  - detectar incoherencias visuales (iluminación, ropa, cámara)
 *  - mantener continuidad cinematográfica entre escenas
 *
 * Hoy queda como skip explícito en el stepper — el slot reserva su lugar
 * en el flujo para que el músculo memoria/UX se construya desde ya.
 */
export default function AiAssistantPhase() {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-pink/10 text-2xl" aria-hidden>
          🤖
        </span>
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            IA Editing Assistant
          </h3>
          <p className="text-xs text-neutral-500">
            Llega en la <strong>Ola 3</strong> — junto con el Scene Memory System.
          </p>
        </div>
      </header>

      <p className="text-sm text-neutral-600">
        Esta fase analizará tu storyboard + timeline para sugerir mejoras
        cinematográficas:
      </p>

      <ul className="grid gap-2 text-xs text-neutral-700 sm:grid-cols-2">
        <Bullet>Sugerir transiciones y close-ups intermedios</Bullet>
        <Bullet>Detectar escenas lentas o pacing irregular</Bullet>
        <Bullet>Alertar rupturas de continuidad (luz, ropa, cámara)</Bullet>
        <Bullet>Mantener consistencia de personajes entre escenas</Bullet>
        <Bullet>Recomendar cortes según la narración</Bullet>
        <Bullet>Sync con beat de música y voz</Bullet>
      </ul>

      <div className="rounded-md bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
        Esta fase queda <strong>opcional</strong>. Saltala con el botón
        <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono">Saltar</span>
        del footer y continuá al export.
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-neutral-100 bg-neutral-50/50 px-2.5 py-1.5">
      <span aria-hidden className="text-brand-pink">▸</span>
      <span>{children}</span>
    </li>
  );
}
