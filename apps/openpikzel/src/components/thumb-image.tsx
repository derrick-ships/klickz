"use client";
import { useState } from "react";

type Props = { src: string; thumbSrc?: string; fallbackSrc?: string; alt: string; aspect: "16:9" | "9:16"; priority?: boolean; className?: string; creationId?: string; onLoad?: (image: HTMLImageElement) => void; onError?: () => void };
export function ThumbImage(props: Props) {
  return <ThumbImageState key={props.src} {...props} />;
}
function ThumbImageState({ src, thumbSrc, fallbackSrc, alt, aspect, priority = false, className = "", creationId, onLoad, onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  return <span data-transition-creation={creationId} className={`thumb-image ${className}`} style={{ aspectRatio: aspect.replace(":", " / ") }}>
    {!loaded && !failed && (thumbSrc && !previewFailed ? <img className="thumb-image-placeholder" src={thumbSrc} alt="" aria-hidden="true" onError={() => setPreviewFailed(true)} /> : <span className="thumb-image-gradient" aria-hidden="true" />)}
    {!failed ? <img key={src} className={loaded ? "thumb-image-main is-loaded" : "thumb-image-main"} src={fallback ? fallbackSrc : src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" onLoad={event => { const image = event.currentTarget; void (image.decode?.() ?? Promise.resolve()).catch(() => {}).then(() => { setLoaded(true); onLoad?.(image); }); }} onError={() => { if (!fallback && fallbackSrc && fallbackSrc !== src) { setFallback(true); return; } setFailed(true); onError?.(); }} /> : <span className="thumb-image-error" role="img" aria-label={`${alt ? alt + ": " : ""}Image unavailable`}>Image unavailable</span>}
  </span>;
}
