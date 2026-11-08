"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Decorative artwork: one short ambient take, then the still. Never loops. */
export function BrandScene({ scene, compact = false }: {
  scene: "aperture" | "signal";
  compact?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const settle = useCallback(() => {
    finished.current = true;
    video.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean };
    }).connection;
    const preference = () => {
      if (reduced.matches || matchMedia("(max-width: 760px)").matches || connection?.saveData) settle();
    };
    const visibility = () => { if (document.hidden) settle(); };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement &&
          event.target.matches('input,textarea,select,[contenteditable="true"]')) settle();
    };
    preference();
    let attempted = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !finished.current && !document.hidden) { attempted = true; setActivated(true); }
      else if (!entry.isIntersecting && attempted) settle();
    }, { threshold: 0.2 });
    if (container.current) observer.observe(container.current);
    reduced.addEventListener("change", preference);
    connection?.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusin", focus);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", preference);
      connection?.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus);
    };
  }, [settle]);

  useEffect(() => {
    const player = video.current;
    if (!activated || !player || finished.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Cap decoration below five seconds; no controls are needed for a finite take.
    void player.play().then(() => {
      if (cancelled || finished.current) { player.pause(); return; }
      setPlaying(true);
      timer = setTimeout(settle, 4400);
    }).catch(settle);
    return () => { cancelled = true; clearTimeout(timer); player.pause(); };
  }, [activated, settle]);

  return (
    <div className={`brand-scene${compact ? " brand-scene--compact" : ""}`}
      ref={container} data-brand-scene={scene} data-motion={playing ? "playing" : "still"}>
      <img src={`/brand/${scene}.webp`}
        srcSet={`/brand/${scene}-672.webp 672w, /brand/${scene}-960.webp 960w, /brand/${scene}.webp 1344w`}
        sizes={compact ? "(max-width: 760px) calc(100vw - 34px), (max-width: 1150px) calc(100vw - 304px), 808px" : "(max-width: 650px) calc(100vw - 32px), (max-width: 1000px) calc(100vw - 48px), 952px"}
        alt="" aria-hidden="true"
        width={1344} height={752} fetchPriority="high" />
      <video ref={video} aria-hidden="true" muted playsInline preload="none"
        onEnded={settle} onError={settle}>
        {activated && <>
          <source src={`/brand/${scene}.webm`} type="video/webm" />
          <source src={`/brand/${scene}.mp4`} type="video/mp4" />
        </>}
      </video>
      <div className="brand-scene-caption" aria-hidden="true">
        <span>OpenPikzels</span>
        <strong>{scene === "aperture" ? "Make the idea unmistakable." : "One clear idea."}</strong>
      </div>
    </div>
  );
}
