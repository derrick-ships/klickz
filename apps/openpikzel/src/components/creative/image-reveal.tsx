"use client";
// OP-10: blur-to-sharp reveal (DELIGHT.md approved exception 1). Visual only: decides a class per <img>.
// The run-once, arrival and resume rules live in @/lib/image-reveal (OP-10a); this file only wires them to the DOM.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import { createRevealRegistry, planImageReveal, resumeDelay, REVEAL_STAGGER_MS, type Arrival, type RevealSurface } from "@/lib/image-reveal";

const registry = createRevealRegistry();
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Call on every Studio render with the same workspace key the arrivals use: a new owner forgets every started reveal. */
export function setRevealOwner(owner: string) { registry.setOwner(owner); }

type Phase = { kind: "static" } | { kind: "pending" } | { kind: "running"; delay: number };

/**
 * An <img> that reveals once, blur-to-sharp, on its real successful load, but only when its creation
 * arrived this session (`arrival`), is not an upload, and has not revealed on this surface yet.
 * Everything else renders exactly as a plain <img>. A failed load never animates. A remount mid-reveal continues.
 */
export function RevealImage({ surface, creationId, arrival, uploaded = false, index = 0, className = "", style, onLoad, onError, ...img }:
  ImgHTMLAttributes<HTMLImageElement> & { surface: RevealSurface; creationId: string; arrival: Arrival | null; uploaded?: boolean; index?: number }) {
  // `index`: this image's place in its batch as the view renders it (see staggerPositions); 0 on the canvas.
  const ref = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return { kind: "static" };
    const startedAt = registry.startedAt(surface, creationId);
    if (startedAt !== null) return resumeDelay({ startedAt, now: performance.now(), index, reduced: reducedMotion() }) === null ? { kind: "static" } : { kind: "pending" };
    return planImageReveal({ surface, id: creationId, arrived: !!arrival, uploaded, seen: registry }) === "reveal" ? { kind: "pending" } : { kind: "static" };
  });
  // Starts (or resumes) only on a real, successful load: a decoded image with pixels. Anything else shows still.
  const start = (image: HTMLImageElement) => {
    const loaded = image.complete && image.naturalWidth > 0, now = performance.now();
    if (!loaded) { setPhase({ kind: "static" }); return; }
    if (registry.claim(surface, creationId, true, now)) { setPhase({ kind: "running", delay: index * REVEAL_STAGGER_MS }); return; }
    const startedAt = registry.startedAt(surface, creationId);
    const delay = startedAt === null ? null : resumeDelay({ startedAt, now, index, reduced: reducedMotion() });
    setPhase(delay === null ? { kind: "static" } : { kind: "running", delay });
  };
  // An image already complete before React attached onLoad (cache) must not stay hidden: settle it now.
  useLayoutEffect(() => {
    const image = ref.current;
    if (phase.kind === "pending" && image?.complete) start(image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loaded = (event: SyntheticEvent<HTMLImageElement>) => {
    onLoad?.(event);
    if (phase.kind === "pending") start(event.currentTarget);
  };
  const cls = phase.kind === "pending" ? "image-reveal-pending" : phase.kind === "running" ? "image-reveal" : "";
  const revealStyle = phase.kind === "running" ? ({ "--i": index, "--reveal-delay": phase.delay + "ms", animationDelay: phase.delay + "ms" } as CSSProperties) : undefined;
  return <img {...img} ref={ref} className={[className, cls].filter(Boolean).join(" ") || undefined} style={revealStyle ? { ...style, ...revealStyle } : style}
    onLoad={loaded}
    onError={event => { onError?.(event); setPhase({ kind: "static" }); }}
    onAnimationEnd={event => { if (event.animationName.startsWith("image-reveal")) setPhase({ kind: "static" }); }} />;
}
