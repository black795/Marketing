'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { ReferenceImage } from '@/components/ReferenceImagesUploader';

interface MentionTextareaProps {
  value: string;
  onChange: (next: string) => void;
  /** Referencias disponibles para mencionar — slot = índice + 1. */
  references: ReferenceImage[];
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
  /** Tag para el aria-label del picker. */
  ariaLabel?: string;
}

/**
 * Textarea con autocompletado de menciones tipo `@imagen1`.
 *
 * El usuario escribe `@`, aparece un picker flotante con las referencias
 * disponibles (thumbnails + nombre). Insertar añade `@imagen{N}` en el
 * cursor. El picker se posiciona debajo del textarea (no se persigue el
 * caret — más simple y portable, y los textareas acá son chicos).
 *
 * El token `@imagenN` se MANTIENE en el texto enviado al backend. La capa
 * de Claude expande la leyenda y propaga la mención a los image_prompt por
 * escena para que el generador de imágenes use la referencia correcta.
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    {
      value,
      onChange,
      references,
      disabled,
      placeholder,
      rows = 4,
      required,
      className,
      ariaLabel,
    },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [highlight, setHighlight] = useState(0);

    function detectMention(text: string, caret: number | null) {
      if (caret == null || references.length === 0) {
        setPickerOpen(false);
        return;
      }
      // Buscar `@palabra` inmediatamente a la izquierda del caret. Permitimos
      // que el `@` esté al inicio del texto o precedido por espacio/newline.
      const before = text.slice(0, caret);
      const m = /(?:^|[\s\n])@(\w*)$/.exec(before);
      if (!m) {
        setPickerOpen(false);
        return;
      }
      setFilter(m[1].toLowerCase());
      setHighlight(0);
      setPickerOpen(true);
    }

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      const next = e.target.value;
      onChange(next);
      detectMention(next, e.target.selectionStart);
    }

    function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      // Reevaluar el picker al mover el cursor con flechas/click.
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        detectMention(e.currentTarget.value, e.currentTarget.selectionStart);
      }
    }

    const filtered = references
      .map((r, i) => ({ ref: r, slot: i + 1 }))
      .filter((opt) => {
        if (!filter) return true;
        return (
          `imagen${opt.slot}`.startsWith(filter) ||
          `img${opt.slot}`.startsWith(filter)
        );
      });

    function insertMention(slot: number) {
      const el = innerRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      // Reemplazar el último @\w* por @imagen{slot}.
      const newBefore = before.replace(/@\w*$/, `@imagen${slot} `);
      const after = value.slice(caret);
      const next = newBefore + after;
      onChange(next);
      setPickerOpen(false);
      requestAnimationFrame(() => {
        const newCaret = newBefore.length;
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      });
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (!pickerOpen || filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[highlight].slot);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPickerOpen(false);
      }
    }

    // Cerrar al perder el foco — pequeño delay para que el click en el item
    // se procese antes del blur.
    useEffect(() => {
      if (!pickerOpen) return;
      function onDocMouseDown(e: MouseEvent) {
        const t = e.target as Node;
        if (innerRef.current?.contains(t)) return;
        if ((t as HTMLElement).closest?.('[data-mention-picker]')) return;
        setPickerOpen(false);
      }
      document.addEventListener('mousedown', onDocMouseDown);
      return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [pickerOpen]);

    return (
      <div className="relative">
        <textarea
          ref={innerRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          disabled={disabled}
          rows={rows}
          required={required}
          placeholder={placeholder}
          className={className}
        />

        {references.length === 0 && /(^|\s)@/.test(value) && (
          <p className="mt-1 text-[10px] italic text-neutral-400">
            Subí referencias abajo para poder mencionarlas con <code>@imagen1</code>.
          </p>
        )}

        {pickerOpen && filtered.length > 0 && (
          <div
            data-mention-picker
            role="listbox"
            aria-label={ariaLabel ?? 'Referencias disponibles'}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
          >
            <div className="sticky top-0 border-b border-neutral-100 bg-white px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Mencionar referencia
              {filter && <span className="ml-1 text-brand-pink">·{filter}</span>}
            </div>
            <ul>
              {filtered.map((opt, idx) => (
                <li key={opt.ref.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === highlight}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(opt.slot);
                    }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition ${
                      idx === highlight ? 'bg-brand-pink/10' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.ref.dataUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-neutral-800">
                        @imagen{opt.slot}
                      </p>
                      <p className="truncate text-[10px] text-neutral-500">
                        {opt.ref.name} · {opt.ref.width}×{opt.ref.height}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="sticky bottom-0 border-t border-neutral-100 bg-white px-2 py-1 text-[10px] text-neutral-400">
              ↑↓ navegar · ↵ insertar · esc cerrar
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default MentionTextarea;
