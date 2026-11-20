"use client";
import { useRef, type PointerEvent } from "react";

export function shouldDismiss(distance: number, size: number, velocity: number) {
  return distance > 0 && (distance > size * 0.3 || velocity > 0.5);
}
export function useSwipeDismiss<T extends HTMLElement>(axis: "x" | "y", dismiss: () => void, enabled = true) {
  const ref = useRef<T>(null);
  const drag = useRef<{ id: number; start: number; last: number; time: number; velocity: number } | null>(null);
  const coord = (event: PointerEvent<HTMLElement>) => axis === "y" ? event.clientY : event.clientX;
  const reset = (el: T) => { el.style.transition = matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)"; el.style.transform = ""; };
  return { ref, handlers: {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || event.pointerType === "mouse" || !matchMedia("(max-width: 640px)").matches || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
      let node = event.target as HTMLElement | null;
      while (node && node !== event.currentTarget) { if (axis === "y" && node.scrollTop > 0) return; node = node.parentElement; }
      if (axis === "y" && event.currentTarget.scrollTop > 0) return;
      const value = coord(event); drag.current = { id: event.pointerId, start: value, last: value, time: event.timeStamp, velocity: 0 };
      if(ref.current) ref.current.style.transition = "none"; event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const state = drag.current; if (!state || state.id !== event.pointerId) return;
      const value = coord(event), delta = Math.max(0, value - state.start), elapsed = event.timeStamp - state.time;
      if (elapsed > 0) state.velocity = (value - state.last) / elapsed;
      state.last = value; state.time = event.timeStamp;
      if(ref.current) ref.current.style.transform = axis === "y" ? `translateY(${delta}px)` : `translateX(${delta}px)`;
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const state = drag.current; if (!state || state.id !== event.pointerId) return;
      drag.current = null; const distance = Math.max(0, coord(event) - state.start);
      const sheet = ref.current; if(!sheet) return;
      const size = axis === "y" ? sheet.offsetHeight : sheet.offsetWidth;
      if (shouldDismiss(distance, size, state.velocity)) { reset(sheet); dismiss(); } else reset(sheet);
    },
    onPointerCancel() { drag.current = null; if(ref.current) reset(ref.current); },
  } };
}
