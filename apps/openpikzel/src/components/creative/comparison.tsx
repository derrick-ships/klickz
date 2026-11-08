"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {MoveHorizontal} from 'lucide-react';
export function ComparisonSlider({before,after}:{before:{src:string;title:string};after:{src:string;title:string}}){
 const [position,setPosition]=useState(50),[failed,setFailed]=useState(false);
 const frame=useRef<HTMLDivElement>(null),clip=useRef<HTMLDivElement>(null),divider=useRef<HTMLSpanElement>(null),range=useRef<HTMLInputElement>(null);
 const current=useRef(50),pointer=useRef<number|null>(null),origin=useRef({x:0,y:0,value:50,touch:false,axis:"pending"});
 function paint(value:number){
  current.current=Math.max(0,Math.min(100,Math.round(value)));
  if(clip.current)clip.current.style.clipPath='inset(0 '+(100-current.current)+'% 0 0)';
  if(divider.current&&frame.current){divider.current.style.left='0';divider.current.style.transform='translate3d('+frame.current.getBoundingClientRect().width*current.current/100+'px,0,0)';}
  if(range.current)range.current.value=String(current.current);
 }
 function move(e:ReactPointerEvent<HTMLDivElement>){if(pointer.current!==e.pointerId)return;const start=origin.current;if(start.touch){const dx=Math.abs(e.clientX-start.x),dy=Math.abs(e.clientY-start.y);if(start.axis==="pending"&&Math.max(dx,dy)>6)start.axis=dx>dy*1.2?"horizontal":"vertical";if(start.axis!=="horizontal")return;}const box=e.currentTarget.getBoundingClientRect();if(box.width)paint((e.clientX-box.left)/box.width*100);}
 function finish(e:ReactPointerEvent<HTMLDivElement>){if(pointer.current!==e.pointerId)return;if(e.type==="pointercancel"||e.type==="lostpointercapture")paint(origin.current.value);else if(origin.current.touch&&origin.current.axis==="pending"){const b=e.currentTarget.getBoundingClientRect();if(b.width)paint((e.clientX-b.left)/b.width*100);}pointer.current=null;setPosition(current.current);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 useEffect(()=>{const el=frame.current;if(!el)return;const observer=new ResizeObserver(()=>paint(current.current));observer.observe(el);paint(50);return()=>observer.disconnect();},[]);
 return <section className="comparison-workspace" aria-label="Before and after image comparison">
 <p className="dialog-description">Drag anywhere on the image to compare. Use the arrow keys for a precise adjustment. Both images stay saved.</p>
 {failed?<p role="alert">An image expired. Close this panel and refresh the workspace.</p>:<div className="comparison-frame" ref={frame}
 onPointerDown={e=>{if(pointer.current!==null||e.button!==0)return;e.preventDefault();pointer.current=e.pointerId;origin.current={x:e.clientX,y:e.clientY,value:current.current,touch:e.pointerType==="touch",axis:e.pointerType==="touch"?"pending":"horizontal"};range.current?.focus({preventScroll:true});try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}move(e);}}
 onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
 <img src={after.src} alt={after.title+' · after'} draggable={false} onError={()=>setFailed(true)}/>
 <div className="comparison-before" ref={clip} style={{clipPath:'inset(0 50% 0 0)'}}><img src={before.src} alt={before.title+' · before'} draggable={false} onError={()=>setFailed(true)}/></div>
 <span className="comparison-label comparison-label--before">Before</span><span className="comparison-label comparison-label--after">After</span>
 <span className="comparison-divider" ref={divider} aria-hidden="true"><span><MoveHorizontal size={20}/></span></span>
 <input ref={range} type="range" min={0} max={100} defaultValue={50} aria-label="Before and after comparison" aria-valuetext={position+'% before; '+(100-position)+'% after'} onChange={e=>{paint(Number(e.target.value));setPosition(current.current);}}/>
 </div>}
 <div className="comparison-links"><a href={before.src} target="_blank" rel="noopener noreferrer">Inspect original</a><a href={after.src} target="_blank" rel="noopener noreferrer">Inspect new version</a></div>
 </section>;
}
