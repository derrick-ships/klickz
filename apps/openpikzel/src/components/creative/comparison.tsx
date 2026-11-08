"use client";
import {useState} from 'react';
import {MoveHorizontal} from 'lucide-react';
export function ComparisonSlider({before,after}:{before:{src:string;title:string};after:{src:string;title:string}}){
 const [position,setPosition]=useState(50),[failed,setFailed]=useState(false);
 return <section className="comparison-workspace" aria-label="Before and after image comparison">
 <p className="dialog-description">Slide to compare both versions. Both images stay saved.</p>
 {failed?<p role="alert">An image expired. Close this panel and refresh the workspace.</p>:<div className="comparison-frame">
 <img src={after.src} alt={after.title+' · after'} onError={()=>setFailed(true)}/>
 <div className="comparison-before" style={{clipPath:'inset(0 '+(100-position)+'% 0 0)'}}><img src={before.src} alt={before.title+' · before'} onError={()=>setFailed(true)}/></div>
 <span className="comparison-label comparison-label--before">Before</span><span className="comparison-label comparison-label--after">After</span>
 <span className="comparison-divider" style={{left:position+'%'}} aria-hidden="true"><span><MoveHorizontal size={20}/></span></span>
 <input type="range" min={0} max={100} value={position} aria-label="Before and after comparison" aria-valuetext={position+'% before; '+(100-position)+'% after'} onChange={e=>setPosition(Number(e.target.value))}/>
 </div>}
 <div className="comparison-links"><a href={before.src} target="_blank" rel="noopener noreferrer">Inspect original</a><a href={after.src} target="_blank" rel="noopener noreferrer">Inspect new version</a></div>
 </section>;
}
