"use client";
import {useEffect,useId,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Minus,Plus,RotateCcw} from 'lucide-react';
import {clampView,zoomView,pinchView,dragView,type ImageView,type Point,type Size} from '@/lib/image-gestures';

type Contact=Point&{origin:Point;previous:Point;time:number;moved:boolean};
const initial:ImageView={x:0,y:0,scale:1};
export function ImageInspector({src,title}:{src:string;title:string}){
 const surface=useRef<HTMLDivElement>(null),photo=useRef<HTMLImageElement>(null);
 const view=useRef<ImageView>({...initial}),box=useRef<Size>({width:0,height:0}),natural=useRef<Size>({width:0,height:0});
 const contacts=useRef(new Map<number,Contact>()),start=useRef<ImageView>({...initial});
 const pinch=useRef<{view:ImageView;mid:Point;distance:number}|null>(null),velocity=useRef<Point>({x:0,y:0});
 const animation=useRef<number|null>(null),lastTap=useRef<{time:number;point:Point}|null>(null);
 const [percent,setPercent]=useState(100),[failed,setFailed]=useState(false),[aspect,setAspect]=useState('16 / 9');
 const hint=useId();
 function publish(){setPercent(Math.round(view.current.scale*100));}
 function stop(){if(animation.current!==null)cancelAnimationFrame(animation.current);animation.current=null;}
 function render(next:ImageView){
  view.current=next;
  if(photo.current)photo.current.style.transform=`translate3d(${next.x}px,${next.y}px,0) scale(${next.scale})`;
  if(surface.current){surface.current.style.touchAction=next.scale>1?'none':'pan-y pinch-zoom';surface.current.dataset.zoomed=String(next.scale>1);}
 }
 function cancelContacts(){
  const el=surface.current,ids=[...contacts.current.keys()];contacts.current.clear();pinch.current=null;lastTap.current=null;velocity.current={x:0,y:0};start.current={...view.current};
  for(const id of ids)if(el?.hasPointerCapture(id))el.releasePointerCapture(id);
 }
 function measure(){
  if(!surface.current)return;const r=surface.current.getBoundingClientRect();box.current={width:r.width,height:r.height};
  stop();cancelContacts();render(clampView(view.current,box.current,natural.current));publish();
 }
 function center(point:Point):Point{const r=surface.current!.getBoundingClientRect();return{x:point.x-r.left-r.width/2,y:point.y-r.top-r.height/2};}
 function zoom(next:number,anchor:Point={x:0,y:0}){stop();cancelContacts();render(zoomView(view.current,next,anchor,box.current,natural.current));publish();}
 function settle(){
  stop();const target=clampView(view.current,box.current,natural.current);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||Math.hypot(target.x-view.current.x,target.y-view.current.y)<.1){render(target);publish();return;}
  // Only edge resistance settles. Ordinary repositioning stops where the finger stops.
  let vx=Math.max(-600,Math.min(600,velocity.current.x)),vy=Math.max(-600,Math.min(600,velocity.current.y)),previous=performance.now(),elapsed=0;
  function tick(now:number){const dt=Math.min(.032,(now-previous)/1000);previous=now;elapsed+=dt;
   const current=view.current;vx+=(500*(target.x-current.x)-42*vx)*dt;vy+=(500*(target.y-current.y)-42*vy)*dt;
   const next={...current,x:current.x+vx*dt,y:current.y+vy*dt};
   if(elapsed>.7||(Math.hypot(next.x-target.x,next.y-target.y)<.2&&Math.hypot(vx,vy)<2)){render(target);animation.current=null;publish();return;}
   render(next);animation.current=requestAnimationFrame(tick);
  }animation.current=requestAnimationFrame(tick);publish();
 }
 function begin(e:ReactPointerEvent<HTMLDivElement>){
  if(e.button!==0||contacts.current.has(e.pointerId)||contacts.current.size>=2||failed)return;
  stop();const p={x:e.clientX,y:e.clientY};contacts.current.set(e.pointerId,{...p,origin:p,previous:p,time:e.timeStamp,moved:false});
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
  velocity.current={x:0,y:0};
  if(contacts.current.size===1){start.current={...view.current};return;}
  if(view.current.scale<=1)return; // At fit, the browser owns pinch-to-zoom.
  const [a,b]=[...contacts.current.values()];a.moved=b.moved=true;
  pinch.current={view:{...view.current},mid:center({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),distance:Math.max(8,Math.hypot(a.x-b.x,a.y-b.y))};
 }
 function move(e:ReactPointerEvent<HTMLDivElement>){
  const p=contacts.current.get(e.pointerId);if(!p)return;
  const dt=Math.max(1,e.timeStamp-p.time);
  velocity.current={x:(e.clientX-p.x)*1000/dt,y:(e.clientY-p.y)*1000/dt};
  p.previous={x:p.x,y:p.y};p.x=e.clientX;p.y=e.clientY;p.time=e.timeStamp;
  if(Math.hypot(p.x-p.origin.x,p.y-p.origin.y)>8)p.moved=true;
  if(view.current.scale<=1&&!pinch.current)return;
  e.preventDefault();
  if(contacts.current.size===2&&pinch.current){
   const [a,b]=[...contacts.current.values()],s=pinch.current;
   render(pinchView(s.view,Math.hypot(a.x-b.x,a.y-b.y)/s.distance,s.mid,center({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),box.current,natural.current));return;
  }
  render(dragView(start.current,{x:p.x-p.origin.x,y:p.y-p.origin.y},box.current,natural.current));
 }
 function end(e:ReactPointerEvent<HTMLDivElement>,cancelled=false){
  const p=contacts.current.get(e.pointerId);if(!p)return;
  const wasPinch=!!pinch.current;contacts.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  pinch.current=null;
  if(cancelled)lastTap.current=null;
  const remaining=[...contacts.current.values()][0];
  if(remaining){remaining.origin={x:remaining.x,y:remaining.y};remaining.moved=true;start.current={...view.current};publish();return;}
  if(!cancelled&&!p.moved&&!wasPinch){
   const now=e.timeStamp,last=lastTap.current;
   if(last&&now-last.time<320&&Math.hypot(p.x-last.point.x,p.y-last.point.y)<32){zoom(view.current.scale>1?1:2,center(p));return;}
   lastTap.current={time:now,point:p};
  }
  settle();
 }
 useEffect(()=>{
  const el=surface.current;if(!el)return;
  cancelContacts();render({...initial});publish();setFailed(false);
  const observer=new ResizeObserver(measure);observer.observe(el);
  return()=>{stop();observer.disconnect();cancelContacts();};
 },[src]);
 return <figure className="image-inspector">
 <div className="image-inspector-controls" role="group" aria-label="Image inspection controls">
  <button type="button" className="icon-button" aria-label="Zoom out" disabled={failed||percent<=100} onClick={()=>zoom(view.current.scale-1)}><Minus size={18}/></button>
  <output aria-label="Image zoom" aria-live="polite">{percent}%</output>
  <button type="button" className="icon-button" aria-label="Zoom in" disabled={failed||percent>=400} onClick={()=>zoom(view.current.scale+1)}><Plus size={18}/></button>
  <button type="button" className="quiet-button" aria-label="Fit image" disabled={failed} onClick={()=>zoom(1)}><RotateCcw size={15}/>Fit</button>
 </div>
 <div ref={surface} className="image-inspector-surface" style={{aspectRatio:aspect}} role="group" aria-label="Zoomable thumbnail" aria-describedby={hint} tabIndex={0}
  onPointerDown={begin} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)}
  onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key==='Home'){e.preventDefault();zoom(1);}
   else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(view.current.scale+1);}
   else if(e.key==='-'){e.preventDefault();zoom(view.current.scale-1);}
   else if(view.current.scale>1&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();stop();render(clampView({...view.current,x:view.current.x+(e.key==='ArrowRight'?40:e.key==='ArrowLeft'?-40:0),y:view.current.y+(e.key==='ArrowDown'?40:e.key==='ArrowUp'?-40:0)},box.current,natural.current));
   }
  }}>
  {failed?<p role="alert">This image could not load. Close this panel and refresh your workspace.</p>:<img className="image-inspector-photo" ref={photo} src={src} alt={title} draggable={false} onLoad={e=>{natural.current={width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight};setAspect(natural.current.width+" / "+natural.current.height);measure();}} onError={()=>{stop();setFailed(true);}}/>}
 </div>
 <p id={hint} className="image-inspector-hint">Double-tap to zoom. Drag when zoomed; Fit shows the whole image. Keyboard: +, −, arrows and Home.</p>
 <figcaption>{title}</figcaption>
 <a className="image-inspector-original" href={src} target="_blank" rel="noopener noreferrer">Open original image</a>
 </figure>;
}
