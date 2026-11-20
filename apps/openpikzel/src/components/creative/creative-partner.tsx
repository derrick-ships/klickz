"use client";
import {useEffect,useRef,useState} from "react";
import type {Config,TextProvider} from "@/lib/types";
export type CreativeMessage={role:"user"|"assistant";content:string};
export type CreativeDraft={includeReferences?:boolean;provider?:"openai"|"google";modelChoice?:"economy"|"standard";draft?:string;messages?:CreativeMessage[]};
type CreativeCall=(input:Record<string,unknown>)=>Promise<any>;
export function PromptEnhancer({prompt,title,mode,format,config,provider="openai",call,onApply,disabled}:{prompt:string;title:string;mode:string;format:string;config:Config|null;provider?:TextProvider;call:CreativeCall;onApply:(before:string,after:string)=>void;disabled:boolean}){
 const [pending,setPending]=useState(false),[error,setError]=useState(""),[proposal,setProposal]=useState<{before:string;prompt:string;changes:string[];model:string}|null>(null);
 const request=useRef<{fingerprint:string;id:string}|null>(null),alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const connected=!!config?.[provider];
 async function enhance(){setPending(true);setError("");const before=prompt,input={task:"enhance",provider,prompt,title,mode,format},fingerprint=JSON.stringify(input);if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
  try{const result=await call({...input,requestId:request.current.id});if(!alive.current)return;setProposal({before,...result.value,model:result.model});request.current=null;}catch(e){if(alive.current)setError(e instanceof Error?e.message:"The prompt could not be improved. Your draft is unchanged.");}finally{if(alive.current)setPending(false);}}
 return <div className="prompt-enhancer">
  <button type="button" className="neutral-button" disabled={disabled||pending||!connected||!config?.ai||prompt.trim().length<8} onClick={enhance}>{pending?"Improving…":"Improve description"}</button>
  <small>{config?.connectionStatus==="failed"?"Connection status is unavailable. Open Keys to refresh before improving a prompt.":connected?(provider==="openai"?"OpenAI · "+(config?.promptModel||"gpt-5.4-nano"):"Google · "+(config?.textModels?.google||"connected AI"))+" · uses your connected balance. Review before applying.":"Connect "+(provider==="openai"?"OpenAI":"Google")+" to improve prompts."}</small>
  {error&&<p role="alert">{error}</p>}
  {proposal&&<section aria-label="Prompt enhancement"><h3>Suggested direction</h3><p className="creative-prose">{proposal.prompt}</p><ul>{proposal.changes.map((change,i)=><li key={i}>{change}</li>)}</ul>
   {prompt!==proposal.before&&<p>Your draft changed. The suggestion is kept here; it will not replace your newer text.</p>}
   <div className="creative-actions"><button type="button" className="neutral-button" disabled={disabled||prompt!==proposal.before} onClick={()=>{onApply(proposal.before,proposal.prompt);setProposal(null);}}>Apply enhancement</button><button type="button" className="neutral-button" onClick={()=>setProposal(null)}>Dismiss suggestion</button></div>
  </section>}
 </div>;
}
