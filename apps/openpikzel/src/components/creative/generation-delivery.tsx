"use client";
import {useEffect,useState,useRef} from "react";
import {scanCounter} from "@/lib/analysis-display";
import type {DeliveryState} from "@/lib/generation-delivery";
export function GenerationDelivery({state,portrait}:{state:DeliveryState;portrait:boolean}){
 const [elapsed,setElapsed]=useState(0),[reduced,setReduced]=useState(true),region=useRef<HTMLElement>(null);
 const active=state.stage==="generating"||state.stage==="analyzing";
 useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)"),update=()=>setReduced(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{if(!active||reduced)return;const start=performance.now(),timer=setInterval(()=>setElapsed(performance.now()-start),250);return()=>clearInterval(timer);},[state.id,active,reduced]);
 useEffect(()=>{if(state.stage==="generating")region.current?.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});},[state.id]);
 const complete=state.stage==="ready"||state.stage==="image-ready",counter=scanCounter(elapsed,complete?"succeeded":active?"running":"failed",reduced);
 const label=state.stage==="generating"?(elapsed>60000?"Still generating your image…":"Creating your thumbnail…"):state.stage==="analyzing"?"Image ready. Analyzing…":state.stage==="ready"?"Image and analysis ready":state.stage==="image-ready"?"Image ready":state.stage==="review-pending"?"Image saved. Review needs attention.":"Generation did not finish.";
 return <section ref={region} className={"generation-delivery "+(!active?"delivery-compact":"")} aria-label="Thumbnail delivery" data-stage={state.stage}>
  {state.stage==="generating"&&<div className={"delivery-placeholder "+(portrait?"portrait":"")}><div className="delivery-light" aria-hidden="true"/><span className="delivery-brand">OpenPikzels<span>✦</span></span><span className="delivery-count" aria-hidden="true">{counter}<small>/100</small></span></div>}
  <div className="delivery-caption"><strong role="status">{label}</strong><p>{state.stage==="analyzing"?"Reviewing "+(state.reviewed+1)+" of "+state.total+". You can inspect your saved image while the score and comments arrive.":state.stage==="review-pending"?"Your image is safe. Open Analyze or API activity to check the existing request; generating the image again is unnecessary.":state.stage==="ready"?"Scores and comments are saved. One-Click Fix is available when the assessment supports a concrete edit.":state.stage==="image-ready"?"Automatic review is off or Jev is not connected. Analyze whenever you are ready.":state.stage==="failed"?"Check API activity and saved creations before starting another paid request.":"The studio stays available while your provider works."}</p>
  {active&&<small>{state.stage==="generating"?"Activity animation, not measured provider progress. ":""}Actual stages: create image → analyze → review. Provider time varies.</small>}</div>
 </section>;
}
