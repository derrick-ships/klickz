"use client";
import { useState } from "react";

type Props = { src: string; thumbSrc?: string; alt: string; aspect: "16:9" | "9:16"; priority?: boolean; className?: string; creationId?: string; onLoad?: (image: HTMLImageElement) => void; onError?: () => void };
export function ThumbImage(props: Props) {
  return <ThumbImageState key={props.src} {...props} />;
}
function ThumbImageState({ src, thumbSrc, alt, aspect, priority = false, className = "", creationId, onLoad, onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  return <span data-transition-creation={creationId} className={`thumb-image ${className}`} style={{ aspectRatio: aspect.replace(":", " / ") }}>
    {!loaded && !failed && (thumbSrc && !previewFailed ? <img className="thumb-image-placeholder" src={thumbSrc} alt="" aria-hidden="true" onError={() => setPreviewFailed(true)} /> : <span className="thumb-image-gradient" aria-hidden="true" />)}
    {!failed ? <img key={src} className={loaded ? "thumb-image-main is-loaded" : "thumb-image-main"} src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" onLoad={event => { setLoaded(true); onLoad?.(event.currentTarget); }} onError={() => { setFailed(true); onError?.(); }} /> : <span className="thumb-image-error" role="img" aria-label={`${alt ? alt + ": " : ""}Image unavailable`}>Image unavailable</span>}
  </span>;
}
