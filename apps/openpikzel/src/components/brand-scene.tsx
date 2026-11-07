"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

/** Brand artwork is decoration, never a placeholder for a user's creation. */
export function BrandScene({
  scene,
  compact = false,
}: {
  scene: "aperture" | "signal";
  compact?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false),
    [playing, setPlaying] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const stop = () => setPlaying(false);
    const visibility = () => {
      if (document.hidden) stop();
    };
    const focus = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.matches('input,textarea,select,[contenteditable="true"]')
      )
        stop();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) stop();
    });
    if (container.current) observer.observe(container.current);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusin", focus);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    reduced.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus);
      reduced.removeEventListener("change", stop);
    };
  }, []);
  useEffect(() => {
    if (!video.current) return;
    if (playing && activated)
      void video.current.play().catch(() => {
        setPlaying(false);
        setUnavailable(true);
      });
    else video.current.pause();
  }, [playing, activated]);
  const name = scene === "aperture" ? "Aperture" : "Signal";
  return (
    <div
      className={`brand-scene${compact ? " brand-scene--compact" : ""}`}
      ref={container}
      data-brand-scene={scene}
    >
      <img
        src={`/brand/${scene}.webp`}
        alt=""
        aria-hidden="true"
        width={1344}
        height={752}
        fetchPriority={compact ? "low" : "high"}
      />
      <video
        ref={video}
        aria-hidden="true"
        muted
        loop
        playsInline
        preload="none"
        poster={`/brand/${scene}.webp`}
        onError={() => {
          setPlaying(false);
          setUnavailable(true);
        }}
      >
        {activated && (
          <>
            <source src={`/brand/${scene}.webm`} type="video/webm" />
            <source src={`/brand/${scene}.mp4`} type="video/mp4" />
          </>
        )}
      </video>
      <div className="brand-scene-caption" aria-hidden="true">
        <span>OpenPikzels</span>
        <strong>
          {scene === "aperture"
            ? "Make the idea unmistakable."
            : "One clear idea."}
        </strong>
      </div>
      {!unavailable && (
        <button
          className="brand-motion-toggle"
          aria-label={`${playing ? "Pause" : "Play"} ${name} brand motion`}
          aria-pressed={playing}
          onClick={() => {
            setActivated(true);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          <span>{playing ? "Pause motion" : "Play motion"}</span>
        </button>
      )}
    </div>
  );
}
