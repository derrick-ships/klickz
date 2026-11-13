"use client";
import {useEffect,useLayoutEffect,useState,useRef} from "react";
import {scanCounter} from "@/lib/analysis-display";
import type {DeliveryState} from "@/lib/generation-delivery";
import {deliveryCopy} from "@/lib/score-on-generate";
export function GenerationDelivery({state,portrait}:{state:DeliveryState;portrait:boolean}){
 const [elapsed,setElapsed]=useState(0),[reduced,setReduced]=useState(true),region=useRef<HTMLElement>(null);
 const active=state.stage==="generating"||state.stage==="analyzing";
 useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)"),update=()=>setReduced(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{if(!active||reduced)return;const start=performance.now(),timer=setInterval(()=>setElapsed(performance.now()-start),250);return()=>clearInterval(timer);},[state.id,active,reduced]);
 useEffect(()=>{if(state.stage==="generating")region.current?.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});},[state.id]);
 // OP-10: when generation ends, the placeholder fades out (200ms) instead of popping; reduced motion removes it at once,
 // also when switched on mid-exit: the reduced-motion reset cancels the exit, so its animationend never arrives.
 // Derived during render (not in an effect) so the placeholder never unmounts for a frame before its exit starts.
 // The page takes its final layout in the frame the image lands, so the result appears where it stays (it never slides):
 // the fading placeholder leaves the flow and stays pinned where it was on screen (its last measured viewport box) while it fades.
 const generating=state.stage==="generating",[wasGenerating,setWasGenerating]=useState(generating),[leaving,setLeaving]=useState(false);
 if(generating!==wasGenerating){setWasGenerating(generating);setLeaving(!generating&&!reduced);}
 else if(leaving&&reduced)setLeaving(false);
 // Its box is read in every waiting commit and on scroll/resize, with the window scroll at that moment: a window scroll whose
 // event has not fired yet when the image lands is subtracted, so the pin matches what was on screen.
 const placeholder=useRef<HTMLDivElement>(null),box=useRef<{rect:DOMRect;x:number;y:number}|null>(null);
 useLayoutEffect(()=>{if(!generating)return;const read=()=>{if(placeholder.current)box.current={rect:placeholder.current.getBoundingClientRect(),x:scrollX,y:scrollY};};
  read();addEventListener("scroll",read,{capture:true,passive:true});addEventListener("resize",read);
  return()=>{removeEventListener("scroll",read,{capture:true});removeEventListener("resize",read);};});
 useLayoutEffect(()=>{const node=placeholder.current,last=box.current;if(!leaving||!node||!last)return;const {rect,x,y}=last;
  for(const [key,value] of [["top",rect.top-(scrollY-y)],["left",rect.left-(scrollX-x)],["width",rect.width],["height",rect.height]] as const)node.style.setProperty("--pin-"+key,value+"px");},[leaving]);
 useEffect(()=>{const node=placeholder.current;if(!leaving||!node)return;const cancel=(event:AnimationEvent)=>{if(event.animationName==="delivery-exit")setLeaving(false);};node.addEventListener("animationcancel",cancel);return()=>node.removeEventListener("animationcancel",cancel);},[leaving]);
 const complete=state.stage==="ready"||state.stage==="image-ready",counter=scanCounter(elapsed,complete?"succeeded":active?"running":"failed",reduced);
 const {label,detail}=deliveryCopy(state,elapsed);
 return <section ref={region} className={"generation-delivery "+(!active?"delivery-compact":"")} aria-label="Thumbnail delivery" data-stage={state.stage}>
  {(state.stage==="generating"||leaving)&&<div ref={placeholder} className={"delivery-placeholder "+(portrait?"portrait":"")+(leaving?" leaving":"")} aria-hidden={leaving||undefined} onAnimationEnd={event=>{if(event.animationName==="delivery-exit")setLeaving(false);}}><div className="delivery-light" aria-hidden="true"/><span className="delivery-brand">OpenPikzels<span>✦</span></span><span className="delivery-count" aria-hidden="true">{counter}<small>/100</small></span></div>}
  <div className="delivery-caption"><strong role="status">{label}</strong><p>{detail}</p>
  {active&&<small>{state.stage==="generating"?"Activity animation, not measured provider progress. ":""}Actual stages: create image → analyze → review. Provider time varies.</small>}</div>
 </section>;
}
