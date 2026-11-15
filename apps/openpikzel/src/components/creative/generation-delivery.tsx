"use client";
import {useEffect,useLayoutEffect,useState,useRef,type CSSProperties} from "react";
import type {DeliveryState} from "@/lib/generation-delivery";
import {ScoreBadge} from "@/components/creative/score-badge";
import {WorkStatus,useElapsed} from "@/components/creative/work-status";
import {estimatedProgress,generationStage,type WorkStage} from "@/lib/ui-spinner-verbs";
import type {Evaluation} from "@/lib/types";
/** A delivered image as the card shows it in the slot its placeholder tile held. `src` is missing until its signed URL exists. */
export type DeliveredImage={id:string;src?:string;alt:string;score?:Evaluation|null;scoring?:boolean;note?:string|null};
// Delivered images that already revealed in this card: a remount, a refreshed URL or the move from the waiting grid to the
// result grid shows them still (never a replay).
const revealed=new Set<string>();
const plural=(n:number,word:string)=>n+" "+word+(n===1?"":"s");
// `hold`: the placeholder is still fading over this slot. A loaded image waits, hidden, until it has gone, so the reveal
// plays in plain view from full blur instead of under the fade.
function DeliveredTile({image,index,hold,selected,onSelect,onOpenScore}:{image:DeliveredImage;index:number;hold:boolean;selected?:boolean;onSelect?:()=>void;onOpenScore?:()=>void}){
 const initialPhase=()=>revealed.has(image.id)?"still" as const:"pending" as const;
 const [phase,setPhase]=useState<"pending"|"running"|"still"|"failed">(initialPhase);
 const [source,setSource]=useState(image.src);
 const ref=useRef<HTMLImageElement>(null);
 if(source!==image.src){setSource(image.src);setPhase(initialPhase());}
 const settle=(img:HTMLImageElement)=>{if(img!==ref.current||!img.complete)return;if(!img.naturalWidth){setPhase("failed");return;}if(phase!=="pending"||hold)return;revealed.add(image.id);setPhase("running");};
 useLayoutEffect(()=>{if(ref.current?.complete&&ref.current.src)settle(ref.current);},[image.src,hold]);
 if(!image.src)return <div className="delivery-tile" data-load="loading" style={{"--i":index} as CSSProperties}><span className="delivery-light" aria-hidden="true"/></div>;
 return <div className="delivery-tile" data-load={phase==="failed"?"failed":undefined} data-selected={selected||undefined} style={{"--i":index} as CSSProperties}>
  <img key={image.src} ref={ref} src={image.src} alt={image.alt} className={phase==="pending"?"delivery-reveal-pending":phase==="running"?"delivery-reveal":undefined}
   style={phase==="running"?{"--i":index} as CSSProperties:undefined}
   onLoad={event=>settle(event.currentTarget)} onError={event=>{if(event.currentTarget===ref.current)setPhase("failed");}}
   onAnimationEnd={event=>{if(event.animationName.startsWith("delivery-reveal"))setPhase("still");}}/>
  {onSelect&&<button type="button" className="delivery-pick" aria-label={"Review image "+(index+1)+": "+image.alt} aria-pressed={!!selected} onClick={onSelect}/>}
  {phase!=="pending"&&<ScoreBadge score={image.score} pending={!image.score&&image.scoring} onOpen={onOpenScore} label={"Image "+(index+1)}/>}
  {image.note&&phase!=="pending"&&<span className="delivery-note">{image.note}</span>}
 </div>;
}
function liveText(state:DeliveryState,requested:number,arrived:number){
 if(state.stage==="generating")return arrived>0?arrived+" of "+requested+" ready":"Creating "+plural(requested,"image");
 if(state.stage==="analyzing"||(state.stage==="review-pending"&&state.reviewed<state.total))return state.total>1?"Scoring "+Math.min(state.total,state.reviewed+1)+" of "+state.total:"Scoring";
 if(state.stage==="review-pending")return "Done. Some scores did not finish";
 if(state.stage==="failed")return "Generation did not finish";
 return "Done";
}
export function GenerationDelivery({state,portrait,images=[],requested,selectedId=null,onSelect,onOpenScore,estimateMs=null}:{state:DeliveryState;portrait:boolean;images?:DeliveredImage[];requested?:number;selectedId?:string|null;onSelect?:(id:string)=>void;onOpenScore?:(id:string)=>void;estimateMs?:number|null}){
 const region=useRef<HTMLElement>(null);
 const [reduced,setReduced]=useState(true);
 const generating=state.stage==="generating",failed=state.stage==="failed";
 const scoring=state.stage==="analyzing"||(state.stage==="review-pending"&&state.reviewed<state.total);
 const active=generating||scoring;
 const elapsed=useElapsed(state.id,active);
 useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)"),update=()=>setReduced(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{if(state.stage==="generating")region.current?.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});},[state.id]);
 const count=Math.max(1,Math.min(16,requested||state.total||images.length||1));
 // OP-10: when generation ends, the placeholder fades out (200ms) instead of popping; reduced motion removes it at once,
 // also when switched on mid-exit: the reduced-motion reset cancels the exit, so its animationend never arrives.
 // Derived during render (not in an effect) so the placeholder never unmounts for a frame before its exit starts.
 const [wasGenerating,setWasGenerating]=useState(generating),[leaving,setLeaving]=useState(false);
 if(generating!==wasGenerating){setWasGenerating(generating);setLeaving(!generating&&!failed&&!reduced);}
 else if(leaving&&reduced)setLeaving(false);
 // Nothing on the page moves when the images land: they take the tiles the placeholder held (the placeholder dissolves over
 // them), and the card keeps the height it had while waiting, so everything below stays where it was.
 const placeholder=useRef<HTMLDivElement>(null),waitingHeight=useRef(0),tray=!generating&&!failed&&images.length>0;
 useLayoutEffect(()=>{const node=region.current;if(!node)return;
  if(generating){node.style.minHeight="";waitingHeight.current=node.offsetHeight;}
  else if(!failed&&waitingHeight.current&&!node.style.minHeight)node.style.minHeight=waitingHeight.current+"px";
  else if(failed)node.style.minHeight="";});
 // A resize reflows the page anyway: the held height would then be wrong, so let the card size itself again.
 useEffect(()=>{if(generating)return;const release=()=>{if(region.current)region.current.style.minHeight="";waitingHeight.current=0;};addEventListener("resize",release);return()=>removeEventListener("resize",release);},[generating]);
 useEffect(()=>{const node=placeholder.current;if(!leaving||!node)return;const cancel=(event:AnimationEvent)=>{if(event.animationName==="delivery-exit")setLeaving(false);};node.addEventListener("animationcancel",cancel);return()=>node.removeEventListener("animationcancel",cancel);},[leaving]);
 // Honest progress: only with a measured median for this account; eases to 95% and jumps to 100% when the images land.
 const progress=generating?estimatedProgress(elapsed,estimateMs):estimateMs&&(leaving||tray)?1:null;
 const stage:WorkStage=generating?generationStage(elapsed,estimateMs):"score";
 const arrivedWhileWaiting=generating?images.length:0;
 const detail=generating?(arrivedWhileWaiting?arrivedWhileWaiting+" of "+count:progress!==null?Math.round(progress*100)+"%":null):state.total>1?Math.min(state.total,state.reviewed+1)+" of "+state.total:null;
 const resultCount=Math.min(images.length,16);
 const doneLine=failed?"Didn’t finish. Check API activity before you try again.":state.stage==="review-pending"&&!scoring?"Some scores didn’t finish.":tray&&resultCount>1?"Tap one to review it.":null;
 return <section ref={region} className={"generation-delivery "+(!active?"delivery-compact":"")} aria-label="Thumbnail delivery" data-stage={state.stage}>
  {(generating||leaving||tray)&&<div className="delivery-slot">
   {tray&&<div className={"delivery-grid delivery-result "+(portrait?"portrait":"")} data-count={resultCount}>{images.slice(0,16).map((image,index)=><DeliveredTile key={image.id} image={image} index={index} hold={leaving}
    selected={resultCount>1&&image.id===selectedId} onSelect={onSelect&&resultCount>1?()=>onSelect(image.id):undefined} onOpenScore={onOpenScore?()=>onOpenScore(image.id):undefined}/>)}</div>}
   {(generating||leaving)&&<div ref={placeholder} className={"delivery-grid delivery-placeholder "+(portrait?"portrait":"")+(leaving?" leaving":"")} data-count={count} aria-hidden="true" onAnimationEnd={event=>{if(event.animationName==="delivery-exit")setLeaving(false);}}>
    {Array.from({length:count},(_,index)=>{const arrived=generating?images[index]:undefined;
     return arrived?<DeliveredTile key={arrived.id} image={arrived} index={index} hold={false}/>:<div key={"ghost-"+index} className="delivery-ghost" style={{"--i":index} as CSSProperties}><span className="delivery-light"/></div>;})}
   </div>}
  </div>}
  {progress!==null&&<div className="delivery-progress" aria-hidden="true" data-done={!generating||undefined}><span style={{transform:`scaleX(${progress})`}}/></div>}
  <div className="delivery-caption">
   <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveText(state,count,arrivedWhileWaiting)}</p>
   {active?<WorkStatus stage={stage} elapsedMs={elapsed} detail={detail} seed={state.id}/>:doneLine?<p className="delivery-line">{doneLine}</p>:null}
  </div>
 </section>;
}
