"use client";
import {useId,useState} from 'react';
import Image from 'next/image';
import {Check,ChevronDown,Search} from 'lucide-react';
import type {ImageModel} from '@/lib/types';
import {imageModels as models} from "@/lib/image-models";
function ProviderLogo({provider,size=24}:{provider:'openai'|'google';size?:number}){return <Image className="provider-logo" src={'/model-logos/'+provider+'.png'} width={size} height={size} alt="" aria-hidden="true"/>;}
export function ModelTrigger({model,label,expanded,onOpen}:{model:ImageModel;label:string;expanded:boolean;onOpen:()=>void}){
 const selected=models.find(m=>m.id===model),currentId=useId();
 return <button type="button" className="model-trigger" aria-label={label+": "+(selected?.name||"Choose model")} aria-describedby={currentId} aria-haspopup="dialog" aria-expanded={expanded} onClick={event=>{event.currentTarget.focus({preventScroll:true});onOpen();}}>{selected&&<ProviderLogo provider={selected.provider} size={18}/>}<span id={currentId}>{selected?.name||'Choose model'}</span><ChevronDown size={13} aria-hidden="true"/></button>;
}
export function ModelPicker({model,onChoose}:{model:ImageModel;onChoose:(value:ImageModel)=>void}){
 const [query,setQuery]=useState(''),matches=models.filter(m=>(m.name+' '+m.provider).toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="model-picker">
 {models.length>6&&<label className="model-search"><Search size={18} aria-hidden="true"/><input autoFocus type="search" aria-label="Search image models" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search image models"/></label>}
 <div className="model-option-list">{matches.map(m=><button type="button" key={m.id} className={'model-option '+(m.id===model?'selected':'')} aria-label={m.name} aria-pressed={m.id===model} aria-describedby={'model-description-'+m.id} onClick={()=>onChoose(m.id)}><span className="provider-logo-tile"><ProviderLogo provider={m.provider}/></span><span className="model-option-copy"><strong>{m.name}</strong><small id={'model-description-'+m.id}>{m.providerName} · {m.id==="flare"?"Fast iteration":m.id==="sunburst"?"Detailed compositions":"Native image generation"}</small></span>{m.id===model&&<Check className="model-selected-check" size={19} aria-hidden="true"/>}</button>)}</div>
 {!matches.length&&<p role="status" className="model-no-results">No models match your search.</p>}
 <p className="dialog-footnote">Uses your own connected OpenAI or Google key.</p>
 </section>;
}
