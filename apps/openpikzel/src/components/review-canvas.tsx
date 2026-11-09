"use client";
import { useState } from "react";
import { RefreshCw, ScanLine, MoreVertical, Play } from "lucide-react";

export function ReviewCanvas({ src, title, feed, pointer, portrait, onRefresh }: {
  src: string; title: string; feed: boolean; pointer: boolean; portrait: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [placement,setPlacement]=useState<"browse"|"suggested">("browse");
  const [monochrome,setMonochrome]=useState(false);
  const image = <div className={`result-image ${feed ? "phone-preview" : ""} ${portrait ? "portrait" : ""}`}>
    {!size && <span className="review-preview-loading" role="status">Loading image…</span>}
    <img key={src} className={size && pointer ? "review-image-arrive" : ""} src={src} alt={title}
      width={size?.width ?? (portrait ? 720 : 1280)} height={size?.height ?? (portrait ? 1280 : 720)}
      onLoad={event=>setSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
      onError={()=>setFailed(true)}/>
  </div>;
  return <figure className="review-canvas" data-preview={feed?"feed":"full"} aria-busy={!failed&&!size}>
    {feed && <div className="feed-preview-controls">
      <div role="group" aria-label="YouTube preview placement">
        <button className="neutral-button" aria-pressed={placement==="browse"} onClick={()=>setPlacement("browse")}>Browse</button>
        <button className="neutral-button" aria-pressed={placement==="suggested"} onClick={()=>setPlacement("suggested")}>Suggested</button>
      </div>
      <button className="neutral-button" aria-pressed={monochrome} onClick={()=>setMonochrome(x=>!x)}>Black &amp; white</button>
    </div>}
    {failed ? <div className="review-preview-error" role="status">
      <ScanLine size={24} aria-hidden="true"/><p>This preview could not load.</p>
      <button className="neutral-button" onClick={()=>{setFailed(false);void onRefresh();}}><RefreshCw size={14}/>Refresh preview</button>
    </div> : feed ? <div className="youtube-preview" data-placement={placement} data-monochrome={monochrome}>
      <div className="youtube-preview-header"><Play size={18} fill="currentColor" aria-hidden="true"/><strong>YouTube</strong><span>Layout preview</span></div>
      <div className="youtube-preview-context" aria-hidden="true">{placement==="browse"?<><b>All</b><span>For you</span><span>Recently uploaded</span></>:<><b>Up next</b><span>Suggested videos</span></>}</div>
      <article className="youtube-preview-card">
        <div className="youtube-preview-thumbnail">{image}<span className="feed-duration" aria-label="Example duration">12:34</span></div>
        <div className="youtube-preview-copy"><span className="feed-avatar" aria-hidden="true">Y</span><div><h3>{title||"Your video title"}</h3><p>Your channel</p><small>Example placement</small></div><MoreVertical size={16} aria-hidden="true"/></div>
      </article>
      <p className="feed-simulation-note">Layout simulation. Channel and duration are examples, not live YouTube data.</p>
      {portrait&&<p className="feed-simulation-note">Standard video placement shown. The Shorts feed uses a different layout.</p>}
    </div> : image}
    <figcaption><span>{feed ? placement==="browse"?"Browse · thumbnail at 200 px":"Suggested · compact recommendation" : "Full image"}</span>
      <span>{failed?"Preview unavailable":size?`${size.width} × ${size.height}`:"Image preview"}</span>
    </figcaption>
    {feed&&<p className="feed-filter-note">Black &amp; white changes this preview only. Your original and download stay in color.</p>}
  </figure>;
}
