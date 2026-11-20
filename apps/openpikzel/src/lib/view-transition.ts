import { flushSync } from "react-dom";

/** Runs `update` exactly once: inside a view transition when the browser supports it, otherwise directly. */
export function withViewTransition(update: () => void, id?: string, source?: HTMLElement | null) {
  let applied = false;
  const apply = () => { if (applied) return; applied = true; update(); };
  if (typeof document === "undefined" || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
  if (!source || source.dataset.transitionCreation !== id || !source.isConnected) source = null;
  const name = id ? `thumb-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}` : "";
  const cleanup = () => {
    if (source) source.style.viewTransitionName = "";
    const target = document.querySelector<HTMLElement>(".result-transition-image");
    if (target?.style.viewTransitionName === name) target.style.viewTransitionName = "";
  };
  if (source) source.style.viewTransitionName = name;
  try {
    const transition = document.startViewTransition(() => {
      if (source) source.style.viewTransitionName = "";
      flushSync(apply);
      const target = document.querySelector<HTMLElement>(".result-transition-image");
      if (target && id && target.dataset.transitionCreation === id) target.style.viewTransitionName = name;
    });
    // An aborted or skipped transition still has to leave the app opened and clean.
    transition.finished.catch(() => {}).finally(() => { apply(); cleanup(); });
  } catch {
    cleanup();
    apply();
  }
}
