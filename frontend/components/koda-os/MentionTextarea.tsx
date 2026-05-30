'use client';

// Textarea con autocompletado @imagenN — versión Koda OS.
// Port del componente legacy (frontend/components/prompts/MentionTextarea.tsx)
// adaptado a CSS vars del design system Koda OS y al tipo ReferenceImage
// del project-store local.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type TextareaHTMLAttributes,
} from 'react';
import type { ReferenceImage } from './project-store';

export interface MentionTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (next: string) => void;
  references: ReferenceImage[];
  rows?: number;
  ariaLabel?: string;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    { value, onChange, references, rows = 4, ariaLabel, style, onFocus, onBlur, ...rest },
    forwardedRef,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [focused, setFocused] = useState(false);

    function detectMention(text: string, caret: number | null) {
      if (caret == null || references.length === 0) {
        setPickerOpen(false);
        return;
      }
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
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
          e.key,
        )
      ) {
        detectMention(e.currentTarget.value, e.currentTarget.selectionStart);
      }
    }

    const filtered = references
      .map((r, i) => ({ ref: r, slot: i + 1 }))
      .filter((opt) => {
        if (!filter) return true;
        return (
          `imagen${opt.slot}`.startsWith(filter) || `img${opt.slot}`.startsWith(filter)
        );
      });

    function insertMention(slot: number) {
      const el = innerRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? value.length;
      const before = value.slice(0, caret);
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

    const textareaStyle: CSSProperties = {
      background: 'var(--bg-1)',
      border: `1px solid ${focused ? 'var(--blue)' : 'var(--line)'}`,
      borderRadius: 10,
      padding: '12px 14px',
      fontSize: 13,
      color: 'var(--fg-1)',
      outline: 'none',
      resize: 'vertical',
      boxShadow: focused ? '0 0 0 3px var(--blue-soft)' : 'none',
      transition: 'all 180ms var(--ease-out)',
      lineHeight: 1.55,
      fontFamily: 'var(--font-body)',
      width: '100%',
      display: 'block',
      ...(style || {}),
    };

    return (
      <div style={{ position: 'relative' }}>
        <textarea
          {...rest}
          ref={innerRef}
          value={value}
          rows={rows}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={textareaStyle}
        />

        {references.length === 0 && /(^|\s)@/.test(value) && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              fontStyle: 'italic',
              color: 'var(--fg-3)',
            }}
          >
            Sub&iacute; referencias abajo para mencionarlas con{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>@imagen1</code>.
          </p>
        )}

        {pickerOpen && filtered.length > 0 && (
          <div
            data-mention-picker
            role="listbox"
            aria-label={ariaLabel ?? 'Referencias disponibles'}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '100%',
              marginTop: 6,
              zIndex: 40,
              maxHeight: 288,
              overflow: 'auto',
              background: 'var(--bg-2)',
              border: '1px solid var(--line-strong)',
              borderRadius: 10,
              boxShadow: '0 12px 32px -8px rgba(0,0,0,0.45)',
            }}
          >
            <div
              className="mono upper"
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--line)',
                padding: '6px 10px',
                fontSize: 10,
                color: 'var(--fg-3)',
                letterSpacing: '0.06em',
              }}
            >
              Mencionar referencia
              {filter && (
                <span style={{ marginLeft: 6, color: 'var(--blue-hi)' }}>
                  &middot;{filter}
                </span>
              )}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 10px',
                      textAlign: 'left',
                      background:
                        idx === highlight ? 'var(--blue-soft)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 140ms',
                      color: 'var(--fg-1)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.ref.dataUrl}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: 6,
                        objectFit: 'cover',
                        border: '1px solid var(--line)',
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color:
                            idx === highlight ? 'var(--blue-hi)' : 'var(--fg-1)',
                        }}
                      >
                        @imagen{opt.slot}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--fg-3)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.ref.name ?? `ref ${opt.slot}`}
                        {opt.ref.width && opt.ref.height
                          ? ` · ${opt.ref.width}×${opt.ref.height}`
                          : ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div
              className="mono"
              style={{
                position: 'sticky',
                bottom: 0,
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--line)',
                padding: '5px 10px',
                fontSize: 10,
                color: 'var(--fg-3)',
              }}
            >
              ↑↓ navegar · ↵ insertar · esc cerrar
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default MentionTextarea;
