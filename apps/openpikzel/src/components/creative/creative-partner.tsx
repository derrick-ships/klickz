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
  <button type="button" className="neutral-button" disabled={disabled||pending||!connected||!config?.ai||prompt.trim().length<8} onClick={enhance}>{pending?"Improving prompt…":"Enhance prompt"}</button>
  <small>{config?.connectionStatus==="failed"?"Connection status is unavailable. Open Connections to refresh before improving a prompt.":connected?(provider==="openai"?"OpenAI · "+(config?.promptModel||"gpt-5.4-nano"):"Google · "+(config?.textModels?.google||"configured text model"))+" · uses your API balance. Review before applying.":"Connect your selected "+(provider==="openai"?"OpenAI":"Google")+" API key to improve prompts."}</small>
  {error&&<p role="alert">{error}</p>}
  {proposal&&<section aria-label="Prompt enhancement"><h3>Suggested direction</h3><p className="creative-prose">{proposal.prompt}</p><ul>{proposal.changes.map((change,i)=><li key={i}>{change}</li>)}</ul>
   {prompt!==proposal.before&&<p>Your draft changed. The suggestion is kept here; it will not replace your newer text.</p>}
   <div className="creative-actions"><button className="neutral-button" disabled={disabled||prompt!==proposal.before} onClick={()=>{onApply(proposal.before,proposal.prompt);setProposal(null);}}>Apply enhancement</button><button className="neutral-button" onClick={()=>setProposal(null)}>Dismiss suggestion</button></div>
  </section>}
 </div>;
}
export function CreativeConversation({value,onChange,config,call,onProposal,sourceId,sourceTitle,disabled,contextKey,selectionSummary="",hasReferenceSelections=false}:{selectionSummary?:string;hasReferenceSelections?:boolean;contextKey:string;value:CreativeDraft;onChange:(next:CreativeDraft)=>void;config:Config|null;call:CreativeCall;onProposal:(proposal:{kind:"generate"|"edit"|"analyze";prompt:string;title:string},sourceId:string|null)=>void;sourceId:string|null;sourceTitle:string;disabled:boolean}){
 const provider=value.provider||"openai",modelChoice=value.modelChoice||"economy",messages=value.messages||[],draft=value.draft||"";
 const [pending,setPending]=useState(false),[error,setError]=useState(""),[proposal,setProposal]=useState<any>(null);
 const request=useRef<{fingerprint:string;id:string}|null>(null),generation=useRef(0),latest=useRef(value);latest.current=value;
 useEffect(()=>{generation.current++;setProposal(null);setPending(false);setError("");request.current=null;return()=>{generation.current++;};},[sourceId]);
 async function send(){const epoch=generation.current,submitted=draft;setPending(true);setError("");const input={task:"chat",provider,modelChoice,prompt:submitted,history:messages.slice(-12),includeReferences:!!value.includeReferences},fingerprint=JSON.stringify({...input,sourceId,contextKey});if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
  try{const result=await call({...input,requestId:request.current.id});if(epoch!==generation.current)return;onChange({...latest.current,provider,modelChoice,draft:latest.current.draft===submitted?"":latest.current.draft,messages:[...messages,{role:"user" as const,content:submitted},{role:"assistant" as const,content:result.value.reply}].slice(-12)});setProposal(result.value.proposal?{...result.value.proposal,sourceId,contextKey}:null);request.current=null;}catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:"The conversation could not finish.");}finally{if(epoch===generation.current)setPending(false);}}
 const connected=!!config?.[provider],selectedModel=provider==="google"?config?.textModels?.google||"configured Google text model":modelChoice==="standard"?config?.textModels?.openai||"configured OpenAI text model":config?.promptModel||"gpt-5.4-nano";
 return <details className="creative-conversation"><summary>Creative chat <span>Brainstorm, refine, then create.</span></summary><div className="creative-conversation-body">
  <p>Conversation and image models are independent. Actions are prepared for your review; chatting never starts image generation.</p>
  <label>Conversation model<select aria-label="Conversation model" value={provider+":"+modelChoice} disabled={pending||disabled} onChange={e=>{const [provider,modelChoice]=e.target.value.split(":") as ["openai"|"google","economy"|"standard"];onChange({...value,provider,modelChoice});}}>
   <option value="openai:economy">OpenAI API · {config?.promptModel||"gpt-5.4-nano"} · economy</option><option value="openai:standard">OpenAI API · {config?.textModels?.openai||"configured model"}</option><option value="google:economy">Google API · {config?.textModels?.google||"configured model"}</option>
  </select></label>
  <p className="creative-context">Context: this project{sourceId?" + selected thumbnail (“"+sourceTitle+"”)":". No thumbnail selected."}. Only recent messages and this context are sent. {selectionSummary}</p>
  <label className="permission-field"><input type="checkbox" checked={!!value.includeReferences} disabled={pending||disabled||!hasReferenceSelections} onChange={e=>onChange({...value,includeReferences:e.target.checked})}/><span>Include the first two selected reference/profile images (extra image-input cost may apply)</span></label>
  <div className="creative-messages" role="log" aria-label="Creative conversation">{messages.length?messages.map((m,i)=><article key={i} className={"creative-message "+m.role}><strong>{m.role==="user"?"You":"OpenPikzels"}</strong><p>{m.content}</p></article>):<p>Try: “Give me three visual directions for this title” or “Simplify the selected thumbnail.”</p>}</div>
  {proposal&&<section className="creative-proposal" aria-label="Suggested action"><strong>{proposal.kind==="analyze"?"Analyze this thumbnail":proposal.kind==="edit"?"Proposed image edit":"Proposed thumbnail"}</strong><p>{proposal.prompt}</p><p>Preparing this action replaces the composer direction. You can undo it before generating. Image or analysis charges apply only when you run it.</p>{proposal.contextKey!==contextKey&&<p>Your context changed after this message. Send another message before preparing an action for the current context.</p>}<button className="neutral-button" disabled={disabled||pending||proposal.sourceId!==sourceId||proposal.contextKey!==contextKey} onClick={()=>onProposal(proposal,proposal.sourceId)}>Review in composer</button></section>}
  <label>Message your creative partner<textarea aria-label="Message your creative partner" value={draft} maxLength={2400} onChange={e=>onChange({...value,draft:e.target.value})} placeholder="Describe the idea or ask about your selected thumbnail."/></label>
  <p>{selectedModel} · one text request{sourceId?" with the selected image":""}, billed to your connected API account. A reliable price estimate is unavailable.</p>
  <p className="creative-availability">ChatGPT and Claude plan access is separate from API access. Subscription chat and Higgsfield image actions are not supported here yet.</p>
  {!connected&&<p>{config?.connectionStatus==="failed"?"Connection status is unavailable. Refresh it in ":"Connect your own "+(provider==="openai"?"OpenAI":"Google")+" API key in "}<a href="/connect">Connections</a>.</p>}
  {error&&<p role="alert">{error}</p>}
  <button className="neutral-button" disabled={disabled||pending||!connected||!config?.ai||draft.trim().length<1} onClick={send}>{pending?"Thinking…":"Send message"}</button>
 </div></details>;
}
