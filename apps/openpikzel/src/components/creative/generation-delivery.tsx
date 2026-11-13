"use client";
import {useEffect,useLayoutEffect,useState,useRef,type CSSProperties} from "react";
import {scanCounter} from "@/lib/analysis-display";
import type {DeliveryState} from "@/lib/generation-delivery";
import {deliveryCopy} from "@/lib/score-on-generate";
/** A delivered image as the card shows it in the slot the placeholder held. `src` is missing until its signed URL exists. */
export type DeliveredImage={id:string;src?:string;alt:string};
// Delivered images that already revealed in this slot: a remount or a refreshed URL shows them still (never a replay).
const revealed=new Set<string>();
function DeliveredTile({image,index}:{image:DeliveredImage;index:number}){
 const [phase,setPhase]=useState<"pending"|"running"|"still"|"failed">(()=>revealed.has(image.id)?"still":"pending");
 const ref=useRef<HTMLImageElement>(null);
 // Starts only on a real, successful load (a decoded image with pixels); a failed load never animates. Reduced motion: CSS fades only.
 const settle=(img:HTMLImageElement)=>{if(phase!=="pending")return;if(!(img.complete&&img.naturalWidth>0)){setPhase("failed");return;}revealed.add(image.id);setPhase("running");};
 useLayoutEffect(()=>{if(ref.current?.complete&&ref.current.src)settle(ref.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 if(!image.src)return <div className="delivery-tile" data-load="loading"/>;
 return <div className="delivery-tile" data-load={phase==="failed"?"failed":undefined}>
  <img ref={ref} src={image.src} alt={image.alt} className={phase==="pending"?"delivery-reveal-pending":phase==="running"?"delivery-reveal":undefined}
   style={phase==="running"?{"--i":index} as CSSProperties:undefined}
   onLoad={event=>settle(event.currentTarget)} onError={()=>{if(phase==="pending"||phase==="running")setPhase("failed");}}
   onAnimationEnd={event=>{if(event.animationName.startsWith("delivery-reveal"))setPhase("still");}}/>
 </div>;
}
export function GenerationDelivery({state,portrait,images=[]}:{state:DeliveryState;portrait:boolean;images?:DeliveredImage[]}){
 const [elapsed,setElapsed]=useState(0),[reduced,setReduced]=useState(true),region=useRef<HTMLElement>(null);
 const active=state.stage==="generating"||state.stage==="analyzing";
 useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)"),update=()=>setReduced(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{if(!active||reduced)return;const start=performance.now(),timer=setInterval(()=>setElapsed(performance.now()-start),250);return()=>clearInterval(timer);},[state.id,active,reduced]);
 useEffect(()=>{if(state.stage==="generating")region.current?.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});},[state.id]);
 // OP-10: when generation ends, the placeholder fades out (200ms) instead of popping; reduced motion removes it at once,
 // also when switched on mid-exit: the reduced-motion reset cancels the exit, so its animationend never arrives.
 // Derived during render (not in an effect) so the placeholder never unmounts for a frame before its exit starts.
 const generating=state.stage==="generating",failed=state.stage==="failed",[wasGenerating,setWasGenerating]=useState(generating),[leaving,setLeaving]=useState(false);
 if(generating!==wasGenerating){setWasGenerating(generating);setLeaving(!generating&&!failed&&!reduced);}
 else if(leaving&&reduced)setLeaving(false);
 // Nothing on the page moves when the image lands: the delivered images take the slot the placeholder held (the placeholder
 // dissolves over them), and the card keeps the height it had while waiting, so everything below stays where it was.
 const placeholder=useRef<HTMLDivElement>(null),waitingHeight=useRef(0),tray=!generating&&!failed&&images.length>0;
 useLayoutEffect(()=>{const node=region.current;if(!node)return;
  if(generating){node.style.minHeight="";waitingHeight.current=node.offsetHeight;}
  else if(!failed&&waitingHeight.current&&!node.style.minHeight)node.style.minHeight=waitingHeight.current+"px";
  else if(failed)node.style.minHeight="";});
 // A resize reflows the page anyway: the held height would then be wrong, so let the card size itself again.
 useEffect(()=>{if(generating)return;const release=()=>{if(region.current)region.current.style.minHeight="";waitingHeight.current=0;};addEventListener("resize",release);return()=>removeEventListener("resize",release);},[generating]);
 useEffect(()=>{const node=placeholder.current;if(!leaving||!node)return;const cancel=(event:AnimationEvent)=>{if(event.animationName==="delivery-exit")setLeaving(false);};node.addEventListener("animationcancel",cancel);return()=>node.removeEventListener("animationcancel",cancel);},[leaving]);
 const complete=state.stage==="ready"||state.stage==="image-ready",counter=scanCounter(elapsed,complete?"succeeded":active?"running":"failed",reduced);
 const {label,detail}=deliveryCopy(state,elapsed);
 return <section ref={region} className={"generation-delivery "+(!active?"delivery-compact":"")} aria-label="Thumbnail delivery" data-stage={state.stage}>
  {(generating||leaving||tray)&&<div className="delivery-slot">
   {tray&&<div className={"delivery-result "+(portrait?"portrait":"")} data-count={Math.min(images.length,4)}>{images.slice(0,4).map((image,index)=><DeliveredTile key={image.id} image={image} index={index}/>)}</div>}
   {(generating||leaving)&&<div ref={placeholder} className={"delivery-placeholder "+(portrait?"portrait":"")+(leaving?" leaving":"")} aria-hidden={leaving||undefined} onAnimationEnd={event=>{if(event.animationName==="delivery-exit")setLeaving(false);}}><div className="delivery-light" aria-hidden="true"/><span className="delivery-brand">OpenPikzels<span>✦</span></span><span className="delivery-count" aria-hidden="true">{counter}<small>/100</small></span></div>}
  </div>}
  <div className="delivery-caption"><strong role="status">{label}</strong><p>{detail}</p>
  {active&&<small>{state.stage==="generating"?"Activity animation, not measured provider progress. ":""}Actual stages: create image → analyze → review. Provider time varies.</small>}
  {tray&&!active&&<small>Edit, analyze or download {images.length>1?"them":"it"} below.</small>}</div>
 </section>;
}
