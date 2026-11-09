"use client";
import { useEffect, useRef, useState } from "react";
import { scanCounter, type ScanPhase } from "@/lib/analysis-display";
export function AnalysisScanner({src,phase,reviewer}:{src:string;phase:ScanPhase;reviewer:string}) {
  const region=useRef<HTMLElement>(null);
  useEffect(()=>{if(phase==="running")region.current?.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});},[phase]);
  const [elapsed,setElapsed]=useState(0),[reduced,setReduced]=useState(true);
  useEffect(()=>{
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(media.matches);
    update();media.addEventListener("change",update);
    return()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    if(phase!=="running"||reduced)return;
    const start=performance.now();
    const timer=setInterval(()=>setElapsed(performance.now()-start),250);
    return()=>clearInterval(timer);
  },[phase,reduced]);
  const counter=scanCounter(elapsed,phase,reduced);
  return <section ref={region} className="analysis-scanner" data-phase={phase} aria-label="Thumbnail analysis activity" aria-busy={phase==="running"}>
    <div className="scanner-image"><img src={src} alt="Thumbnail being assessed"/>{phase==="running"&&<span className="scanner-sweep" aria-hidden="true"/>}
      <span className="scanner-counter" aria-hidden="true">{counter}<small>/100</small></span>
    </div>
    <div className="scanner-caption"><strong role="status">{phase==="running"?"Analyzing your thumbnail…":phase==="succeeded"?"Analysis ready":"Analysis did not finish"}</strong>
    <p>{phase==="failed"?"Your image is unchanged. The request may have finished; check saved results before retrying.":reviewer}</p>
    <small>{phase==="running"?"Scan animation, not measured progress. It waits below 100 until the result is ready.":phase==="succeeded"?"The analysis result has been received and saved.":"No completed result is being claimed."}</small></div>
  </section>;
}
