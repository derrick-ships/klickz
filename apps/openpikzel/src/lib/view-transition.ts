import { flushSync } from "react-dom";

export function withViewTransition(update: () => void, id?: string, source?: HTMLElement | null) {
  if (typeof document === "undefined" || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
  if (!source || source.dataset.transitionCreation !== id || !source.isConnected) source = null;
  const name = id ? `thumb-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}` : "";
  if (source) source.style.viewTransitionName = name;
  const transition = document.startViewTransition(() => { if (source) source.style.viewTransitionName = ""; flushSync(update); const target = document.querySelector<HTMLElement>(".result-transition-image"); if (target && id && target.dataset.transitionCreation === id) target.style.viewTransitionName = name; });
  void transition.finished.finally(() => { if (source) source.style.viewTransitionName = ""; const target = document.querySelector<HTMLElement>(".result-transition-image"); if (target?.style.viewTransitionName === name) target.style.viewTransitionName = ""; });
}
