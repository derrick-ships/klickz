"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { checkImage, verdicts, type FeedCheck } from "@/lib/feed-check";
import { RefreshCw, ScanLine, MoreVertical, Play, Check, AlertTriangle } from "lucide-react";
import { RevealImage } from "@/components/creative/image-reveal";
import type { Arrival } from "@/lib/image-reveal";

export function ReviewCanvas({ src, title, feed, portrait, onRefresh, creationId, arrival, uploaded, badge }: {
  src: string; title: string; feed: boolean; portrait: boolean;
  onRefresh: () => Promise<unknown>;
  // OP-10: which creation this is and whether it arrived this session (see createArrivals).
  creationId: string; arrival: Arrival | null; uploaded: boolean;
  /** Score shown on the image (hidden in the feed preview, which simulates YouTube). */
  badge?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [placement,setPlacement]=useState<"browse"|"suggested">("browse");
  const [monochrome,setMonochrome]=useState(false);
  const [theme,setTheme]=useState<"dark"|"light">("dark");
  const [squint,setSquint]=useState(false);
  const [check,setCheck]=useState<FeedCheck|null>(null);
  // Pixel checks run in the browser only when the feed preview opens; nothing is sent anywhere.
  useEffect(()=>{if(!feed||check)return;let live=true;checkImage(src).then(c=>{if(live)setCheck(c);}).catch(()=>{});return()=>{live=false;};},[feed,src,check]);
  // View Transitions crossfade the feed when a test changes; browsers without it switch instantly.
  const morph=(update:()=>void)=>{const d=document as Document&{startViewTransition?:(cb:()=>void)=>unknown};if(d.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches)d.startViewTransition(update);else update();};
  const image = <div className={`result-image ${feed ? "phone-preview" : ""} ${portrait ? "portrait" : ""}`}>
    {!size && <span className="review-preview-loading" role="status">Loading image…</span>}
    {!feed && size && badge}
    <RevealImage key={src} surface="canvas" creationId={creationId} arrival={arrival} uploaded={uploaded} src={src} alt={title}
      width={size?.width ?? (portrait ? 720 : 1280)} height={size?.height ?? (portrait ? 1280 : 720)}
      onLoad={event=>setSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
      onError={()=>setFailed(true)}/>
  </div>;
  return <figure className="review-canvas" data-preview={feed?"feed":"full"} aria-busy={!failed&&!size}>
    {feed && <div className="feed-preview-controls">
      <div role="group" aria-label="YouTube preview placement"><span className="feed-group-label">Placement</span>
        <button type="button" className="neutral-button" aria-pressed={placement==="browse"} onClick={()=>morph(()=>setPlacement("browse"))}>Browse</button>
        <button type="button" className="neutral-button" aria-pressed={placement==="suggested"} onClick={()=>morph(()=>setPlacement("suggested"))}>Suggested</button>
      </div>
      <div role="group" aria-label="Feed theme"><span className="feed-group-label">Theme</span>
        <button type="button" className="neutral-button" aria-pressed={theme==="dark"} onClick={()=>morph(()=>setTheme("dark"))}>Dark</button>
        <button type="button" className="neutral-button" aria-pressed={theme==="light"} onClick={()=>morph(()=>setTheme("light"))}>Light</button>
      </div>
      <div role="group" aria-label="Thumbnail tests"><span className="feed-group-label">Test</span>
        <button type="button" className="neutral-button" aria-pressed={monochrome} onClick={()=>morph(()=>setMonochrome(x=>!x))}>Monochrome</button>
        <button type="button" className="neutral-button" aria-pressed={squint} onClick={()=>morph(()=>setSquint(x=>!x))}>Squint</button>
      </div>
    </div>}
    {failed ? <div className="review-preview-error" role="status">
      <ScanLine size={24} aria-hidden="true"/><p>This preview could not load.</p>
      <button type="button" className="neutral-button" onClick={()=>{setFailed(false);void onRefresh();}}><RefreshCw size={14}/>Refresh preview</button>
    </div> : feed ? <div className="youtube-preview" data-placement={placement} data-monochrome={monochrome} data-theme={theme} data-squint={squint}>
      <div className="youtube-preview-header"><Play size={18} fill="currentColor" aria-hidden="true"/><strong>YouTube</strong><span>Layout preview</span></div>
      <div className="youtube-preview-context" aria-hidden="true">{placement==="browse"?<><b>All</b><span>For you</span><span>Recently uploaded</span></>:<><b>Up next</b><span>Suggested videos</span></>}</div>
      <article className="youtube-preview-card">
        <div className="youtube-preview-thumbnail">{image}<span className="feed-duration" aria-label="Example duration">12:34</span></div>
        <div className="youtube-preview-copy"><span className="feed-avatar" aria-hidden="true">Y</span><div><h3 className={!title.trim()?"feed-title-placeholder":undefined}>{title.trim()||"Add a video title to preview it"}</h3><p>Your channel</p><small>Example placement</small></div><MoreVertical size={16} aria-hidden="true"/></div>
      </article>
      <p className="feed-simulation-note">Layout simulation. Channel and duration are examples, not live YouTube data.</p>
      {portrait&&<p className="feed-simulation-note">Standard video placement shown. The Shorts feed uses a different layout.</p>}
    </div> : image}
    <figcaption><span>{feed ? placement==="browse"?"Browse · thumbnail at 200 px":"Suggested · compact recommendation" : "Full image"}</span>
      <span>{failed?"Preview unavailable":!size?"Image preview":""}</span>
    </figcaption>
    {feed&&squint&&<p className="feed-filter-note">{!check?"Checking image readability…":verdicts(check).every(v=>v.pass)?"Pixel checks pass; use the blurred preview to judge the overall shape.":"Some pixel checks need attention; use the blurred preview to judge the overall shape."}</p>}
    {feed&&check&&<ul className="feed-verdicts" aria-label="Feed checks">{verdicts(check).map(v=><li key={v.id} data-pass={v.pass}>{v.pass?<Check size={15} aria-hidden="true"/>:<AlertTriangle size={15} aria-hidden="true"/>}<span><strong>{v.label}</strong> {v.detail}</span></li>)}</ul>}
    {feed&&<p className="feed-filter-note">These tests change this preview only. Your original and download stay in color. Checks are measured from the image’s pixels in your browser; they describe readability, not predicted clicks.</p>}
  </figure>;
}
