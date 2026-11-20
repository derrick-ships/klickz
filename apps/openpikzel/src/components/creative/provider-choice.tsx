"use client";
import type {Config,TextProvider} from "@/lib/types";
// connectedShownNearby: the studio key note already says this key is in use, so the helper does not repeat it.
export function ProviderChoice({value,onChange,config,label="Text and review provider",disabled=false,connectedShownNearby=false}:{value:TextProvider;onChange:(value:TextProvider)=>void;config:Config|null;label?:string;disabled?:boolean;connectedShownNearby?:boolean}){
 const name=value==="openai"?"OpenAI":"Google";
 return <div className="provider-choice"><label>{label}<select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as TextProvider)}><option value="openai">OpenAI</option><option value="google">Google</option></select></label><p>{config?.connectionStatus==="failed"?"Connection status is unavailable. Open Keys to refresh it.":config?.connectionStatus==="loading"?"Checking the current account’s saved connections…":config?.[value]?(connectedShownNearby?"":name+" key connected. ")+"Access and balance are checked when you run.":"Connect "+name+" in Keys, or choose another here."} Your AI account balance pays for requests.</p></div>;
}
