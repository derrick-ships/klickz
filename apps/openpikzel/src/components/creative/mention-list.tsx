"use client";
import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import type { Persona } from "@/lib/types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The "@query" being typed right before the caret, if any. */
function tokenAt(value: string, caret: number) {
  const m = value.slice(0, caret).match(/(^|\s)@([^\s@]{0,40})$/);
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}
const mentioned = (value: string, name: string) => new RegExp("(^|\\s)@" + escape(name) + "(?=$|[\\s.,!?;:])", "i").test(value);

/**
 * @mentions for personas in a textarea: typing "@" lists the user's personas (filtered as they type), arrows/Enter/tap pick
 * one, Escape closes. Picking inserts "@Name " at the caret and selects the persona. Typing a full name selects it too.
 * Textbox + listbox pattern: aria-autocomplete="list", aria-controls and aria-activedescendant on the textarea.
 */
export function usePersonaMentions({ value, setValue, personas, images, selectedId, onSelect, textarea }: {
  value: string; setValue: (next: string) => void; personas: Persona[]; images: Record<string, string>;
  selectedId: string; onSelect: (id: string) => void; textarea: RefObject<HTMLTextAreaElement | null>;
}) {
  const lastPointer = useRef<string | null>(null), listId = useId(), [token, setToken] = useState<{ start: number; query: string } | null>(null), [active, setActive] = useState(0);
  const q = token?.query.toLowerCase() ?? "";
  const matches = token ? personas.filter(p => p.name.toLowerCase().startsWith(q)).concat(personas.filter(p => !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q))).slice(0, 6) : [];
  const open = !!token && personas.length > 0 && matches.length > 0;
  const index = Math.min(active, Math.max(0, matches.length - 1));
  const sync = (el: HTMLTextAreaElement) => { const next = tokenAt(el.value, el.selectionStart ?? el.value.length); setToken(t => (t?.start === next?.start && t?.query === next?.query ? t : next)); if (next?.query !== token?.query) setActive(0); };
  function pick(persona: Persona) {
    const el = textarea.current, caret = el?.selectionStart ?? value.length, start = token?.start ?? caret;
    const insert = "@" + persona.name + " ", next = value.slice(0, start) + insert + value.slice(caret);
    setValue(next.slice(0, 2400)); setToken(null);
    if (persona.id !== selectedId) onSelect(persona.id);
    requestAnimationFrame(() => { const at = Math.min(2400, start + insert.length); el?.focus(); el?.setSelectionRange(at, at); });
  }
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    // A full name typed by hand selects that persona, once, when it first appears.
    const typed = personas.find(p => mentioned(next, p.name) && !mentioned(value, p.name));
    setValue(next); sync(event.target);
    if (typed && typed.id !== selectedId) onSelect(typed.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive((index + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length); }
    else if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); pick(matches[index]); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setToken(null); }
  };
  const optionId = (i: number) => listId + "-option-" + i;
  return {
    inputProps: {
      onChange, onKeyDown,
      onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => sync(event.currentTarget),
      onBlurCapture: () => setTimeout(() => { if (document.activeElement !== textarea.current) setToken(null); }, 120),
      "aria-autocomplete": "list" as const,
      "aria-controls": open ? listId : undefined,
      "aria-activedescendant": open ? optionId(index) : undefined,
    },
    list: open ? <>
      <ul id={listId} className="mention-list" role="listbox" aria-label="Personas">
        {matches.map((p, i) => <li key={p.id} id={optionId(i)} role="option" aria-selected={i === index} className="mention-option"
          onPointerDown={e => e.preventDefault()} onPointerMove={e => { const at = e.clientX + "," + e.clientY; if (lastPointer.current !== null && lastPointer.current !== at && i !== index) setActive(i); lastPointer.current = at; }} onClick={() => pick(p)}>
          {images[p.refs[0]] ? <img src={images[p.refs[0]]} alt="" width={28} height={28} /> : <span className="mention-avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>}
          <span className="mention-name">{p.name}</span>
          {p.id === selectedId && <span className="mention-current">Selected</span>}
        </li>)}
      </ul>
      <span className="sr-only" role="status">{matches.length + (matches.length === 1 ? " persona" : " personas")}. Use arrow keys, then Enter.</span>
    </> : null,
  };
}
