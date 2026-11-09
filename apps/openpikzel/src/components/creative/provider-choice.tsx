"use client";
import type {Config,TextProvider} from "@/lib/types";
export function ProviderChoice({value,onChange,config,label="Text and review provider",disabled=false}:{value:TextProvider;onChange:(value:TextProvider)=>void;config:Config|null;label?:string;disabled?:boolean}){
 const name=value==="openai"?"OpenAI":"Google";
 return <div className="provider-choice"><label>{label}<select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as TextProvider)}><option value="openai">OpenAI API</option><option value="google">Google API</option></select></label><p>{config?.connectionStatus==="failed"?"Connection status is unavailable. Open Connections to refresh it.":config?.connectionStatus==="loading"?"Checking the current account’s saved provider connections…":config?.[value]?name+" key connected. Model access and balance are checked when you run.":"Connect your own "+name+" API key in Connections, or choose another provider here."} Each text or image-review request uses the selected provider’s API balance; its total cost is unknown.</p></div>;
}
