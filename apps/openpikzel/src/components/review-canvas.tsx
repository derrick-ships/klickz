"use client";
import { useState } from "react";
import { RefreshCw, ScanLine } from "lucide-react";

export function ReviewCanvas({ src, title, feed, pointer, portrait, onRefresh }: {
  src: string; title: string; feed: boolean; pointer: boolean; portrait: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <figure className="review-canvas" data-preview={feed ? "feed" : "full"}>
      {failed ? (
        <div className="review-preview-error" role="status">
          <ScanLine size={24} aria-hidden="true" />
          <p>This preview could not load.</p>
          <button className="neutral-button" onClick={() => { setFailed(false); void onRefresh(); }}><RefreshCw size={14} />Refresh preview</button>
        </div>
      ) : (
        <>
          <div className={`result-image ${feed ? "phone-preview" : ""} ${portrait ? "portrait" : ""}`}>
            <img key={src} className={size && pointer ? "review-image-arrive" : ""} src={src} alt={title}
              onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setFailed(true)} />
          </div>
          {feed && <p className="review-feed-title">{title}</p>}
        </>
      )}
      <figcaption>
        <span>{feed ? "Feed preview at 200 px" : "Full image"}</span>
        <span>{size ? `${size.width} × ${size.height}` : "Image preview"}</span>
      </figcaption>
    </figure>
  );
}
