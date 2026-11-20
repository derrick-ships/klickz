"use client";
import { useEffect, useLayoutEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
type Mentionable = {id:string;name:string;refs:string[];kind?:"persona"|"element"};

/** At most this many personas appear in one thumbnail (the server enforces the same cap). */
export const MAX_PERSONAS = 3;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The "@query" being typed right before the caret, if any. */
function tokenAt(value: string, caret: number) {
  const m = value.slice(0, caret).match(/(^|\s)@([^\s@]{0,40})$/);
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}
const mentionPattern = (name: string, flags = "i") => new RegExp("(^|\\s)(@" + escape(name) + ")(?=$|[\\s.,!?;:])", flags);
export const mentioned = (value: string, name: string) => mentionPattern(name).test(value);

/**
 * Splits the prompt into plain text and "@Name" mentions of saved personas, so the composer can paint
 * mentions in the accent colour. Longer names win ("@Ana Maria" before "@Ana").
 */
export function mentionSegments(value: string, names: string[]): { text: string; mention: boolean }[] {
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!sorted.length || !value.includes("@")) return [{ text: value, mention: false }];
  const pattern = new RegExp("(^|\\s)(@(?:" + sorted.map(escape).join("|") + "))(?=$|[\\s.,!?;:])", "gi");
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of value.matchAll(pattern)) {
    const at = m.index! + m[1].length;
    if (at > last) out.push({ text: value.slice(last, at), mention: false });
    out.push({ text: m[2], mention: true });
    last = at + m[2].length;
  }
  if (last < value.length) out.push({ text: value.slice(last), mention: false });
  return out;
}

/** "@Name" becomes "Name": used when a persona chip is removed so no stale accent mention stays behind. */
export function unmention(value: string, name: string) {
  return value.replace(new RegExp(mentionPattern(name).source, "gi"), (_m, lead: string) => lead + name);
}

/**
 * @mentions for personas in a textarea: typing "@" lists the user's personas (filtered as they type), arrows/Enter/tap pick
 * one, Escape closes. Picking inserts "@Name " at the caret and adds the persona (up to three). Typing a full name adds it
 * too, and deleting a mention from the text removes that persona. Personas picked from the Persona dialog are not in the
 * text, so editing the text never drops them.
 * Textbox + listbox pattern: aria-autocomplete="list", aria-controls and aria-activedescendant on the textarea.
 */
export function usePersonaMentions({ value, setValue, personas, images, selectedIds, onChange: onSelectionChange, onLimit, textarea }: {
  value: string; setValue: (next: string) => void; personas: Mentionable[]; images: Record<string, string>;
  selectedIds: string[]; onChange: (ids: string[]) => void; onLimit?: () => void; textarea: RefObject<HTMLTextAreaElement | null>;
}) {
  const pendingCaret=useRef<number|null>(null);
  useLayoutEffect(()=>{if(pendingCaret.current!==null){const at=pendingCaret.current;pendingCaret.current=null;textarea.current?.focus();textarea.current?.setSelectionRange(at,at);}},[value,textarea]);
  const lastPointer = useRef<string | null>(null), listId = useId(), [token, setToken] = useState<{ start: number; query: string } | null>(null), [active, setActive] = useState(0);
  const q = token?.query.toLowerCase() ?? "";
  const matches = token ? personas.filter(p => p.name.toLowerCase().startsWith(q)).concat(personas.filter(p => !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q))).slice(0, 6) : [];
  const open = !!token && personas.length > 0 && matches.length > 0;
  const index = Math.min(active, Math.max(0, matches.length - 1));
  const sync = (el: HTMLTextAreaElement) => { const next = tokenAt(el.value, el.selectionStart ?? el.value.length); setToken(t => (t?.start === next?.start && t?.query === next?.query ? t : next)); if (next?.query !== token?.query) setActive(0); };
  const role=(id:string)=>personas.find(p=>p.id===id)?.kind||"persona";
  const count=(ids:string[],id:string)=>ids.filter(p=>role(p)===role(id)).length;
  function add(ids: string[], id: string) {
    if (ids.includes(id)) return ids;
    if (count(ids,id) >= MAX_PERSONAS) { onLimit?.(); return ids; }
    return [...ids, id];
  }
  function pick(persona: Mentionable) {
    const el = textarea.current, caret = el?.selectionStart ?? value.length, start = token?.start ?? caret;
    if (!selectedIds.includes(persona.id) && count(selectedIds,persona.id) >= MAX_PERSONAS) { setToken(null); onLimit?.(); return; }
    const insert = "@" + persona.name + " ", next = value.slice(0, start) + insert + value.slice(caret);
    setValue(next.slice(0, 2400)); setToken(null);
    const ids = add(selectedIds, persona.id);
    if (ids !== selectedIds) onSelectionChange(ids);
    pendingCaret.current=Math.min(2400,start+insert.length);
  }
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    let ids = selectedIds;
    // A mention deleted from the text removes that persona; a full name typed by hand adds it, once.
    for (const p of personas) {
      const was = mentioned(value, p.name), is = mentioned(next, p.name);
      if (was && !is && ids.includes(p.id)) ids = ids.filter(id => id !== p.id);
      else if (!was && is) ids = add(ids, p.id);
    }
    setValue(next); sync(event.target);
    if (ids !== selectedIds) onSelectionChange(ids);
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
      <ul id={listId} className="mention-list" role="listbox" aria-label={personas.some(p=>p.kind==="element")?"People and elements":"People"}>
        {matches.map((p, i) => <li key={p.id} id={optionId(i)} role="option" aria-selected={i === index} className="mention-option"
          onPointerDown={e => e.preventDefault()} onPointerMove={e => { const at = e.clientX + "," + e.clientY; if (lastPointer.current !== null && lastPointer.current !== at && i !== index) setActive(i); lastPointer.current = at; }} onClick={() => pick(p)}>
          {images[p.refs[0]] ? <img src={images[p.refs[0]]} alt="" width={28} height={28} /> : <span className="mention-avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>}
          <span className="mention-name">{p.name}{p.kind==='element'&&<small> · Element</small>}</span>
          {selectedIds.includes(p.id) && <span className="mention-current">Added</span>}
        </li>)}
      </ul>
      <span className="sr-only" role="status">{matches.length + (matches.length === 1 ? " person" : " people")}. Use arrow keys, then Enter.</span>
    </> : null,
  };
}

/**
 * Paints "@Name" mentions in the accent colour behind a textarea whose own text is made transparent
 * (`.prompt-field--mentions`). It copies the textarea's size and scroll so wrapping and lines match exactly.
 * Decorative only: the textarea stays the accessible field.
 */
export function MentionMirror({ textarea, value, names }: { textarea: RefObject<HTMLTextAreaElement | null>; value: string; names: string[] }) {
  const mirror = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = textarea.current, out = mirror.current;
    if (!el || !out) return;
    const syncBox = () => {
      const cs = getComputedStyle(el);
      for (const key of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "wordSpacing", "textIndent", "paddingTop", "paddingBottom", "paddingLeft", "borderTopWidth", "borderLeftWidth", "borderBottomWidth", "borderRightWidth"] as const) out.style[key] = cs[key];
      out.style.borderStyle = "solid"; out.style.borderColor = "transparent";
      // The textarea's scrollbar (if any) narrows its text box; widen the mirror's right padding by the same amount.
      out.style.paddingRight = (parseFloat(cs.paddingRight) + el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)) + "px";
      out.style.width = "100%"; out.style.height = el.offsetHeight + "px"; out.style.top = el.offsetTop + "px"; out.style.left = el.offsetLeft + "px";
      out.scrollTop = el.scrollTop;
    };
    const syncScroll = () => { out.scrollTop = el.scrollTop; };
    const observer = new ResizeObserver(syncBox);
    observer.observe(el); syncBox();
    el.addEventListener("scroll", syncScroll, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", syncScroll); };
  }, [textarea]);
  useEffect(() => { const el = textarea.current, out = mirror.current; if (el && out) out.scrollTop = el.scrollTop; }, [value, textarea]);
  const parts: ReactNode[] = mentionSegments(value, names).map((s, i) => s.mention ? <span key={i} className="prompt-mention">{s.text}</span> : s.text);
  // A trailing newline needs a character after it to take up a line, as in the textarea.
  return <div ref={mirror} className="prompt-mirror" aria-hidden="true">{parts}{value.endsWith("\n") ? " " : null}</div>;
}
