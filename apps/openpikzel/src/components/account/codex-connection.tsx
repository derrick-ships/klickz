"use client";
import {useEffect,useRef,useState} from "react";
type Status={connected:boolean;phase:string;needsReauth?:boolean;label?:string;plan?:string;attemptId?:string;userCode?:string;expiresAt?:string;pollAfter?:number;windows?:{kind:string;usedPercent?:number;resetsAt?:number}[];models?:{id:string;name:string}[];checkedAt?:string;usageAvailable?:boolean;modelsAvailable?:boolean};
type Api=(path:string,method?:string,body?:unknown)=>Promise<Status>;
const endpoint="/api/connections/codex",verify="https://auth.openai.com/codex/device";
export function CodexConnection({signedIn,enabled,api}:{signedIn:boolean;enabled:boolean;api:Api}){
 const [status,setStatus]=useState<Status>({connected:false,phase:"loading"}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const apiRef=useRef(api),epoch=useRef(0),mounted=useRef(true),popup=useRef<Window|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 apiRef.current=api;
 function stop(){epoch.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;}
 function accept(next:Status,version:number){if(!mounted.current||epoch.current!==version)return;setStatus(next);
  if(next.attemptId&&["waiting_device","polling","starting","exchanging"].includes(next.phase)){
   timer.current=setTimeout(()=>{void poll(next.attemptId!,version);},Math.max(5,next.pollAfter||5)*1000);
  }else if(next.phase==="connected"){popup.current?.close();setNotice("ChatGPT connected. No generation request was made.");}
 }
 async function poll(id:string,version:number){
  try{const next=await apiRef.current(endpoint,"POST",{action:"poll",attemptId:id});if(epoch.current===version)setError("");accept(next,version);}
  catch{if(!mounted.current||epoch.current!==version)return;setError("Could not check sign-in. Retrying shortly. You can cancel at any time.");timer.current=setTimeout(()=>{void poll(id,version);},10000);}
 }
 useEffect(()=>{mounted.current=true;if(signedIn&&enabled){const version=epoch.current;void apiRef.current(endpoint).then(s=>accept(s,version)).catch(()=>{if(mounted.current)setError("Could not load your ChatGPT connection. Reload this page to retry.");});}
  return()=>{mounted.current=false;stop();};},[signedIn,enabled]);
 async function act(action:"start"|"cancel"|"disconnect"|"check"){
  stop();const version=epoch.current;setBusy(true);setError("");setNotice("");
  if(action==="start"){try{popup.current=window.open(verify,"openpikzels-codex","popup,width=520,height=740");if(popup.current)popup.current.opener=null;}catch{popup.current=null;}}
  try{
   const next=await apiRef.current(endpoint,action==="disconnect"?"DELETE":"POST",action==="disconnect"?undefined:{action, ...(action==="cancel"?{attemptId:status.attemptId}:{})});
   accept(next,version);
   if(action==="cancel"||action==="disconnect"){popup.current?.close();setNotice(action==="cancel"?"Sign-in cancelled.":"ChatGPT connection removed from OpenPikzels.");}
  }catch(e){if(mounted.current&&epoch.current===version){setError(e instanceof Error?e.message:"Could not update the connection.");if(action==="start")popup.current?.close();}}
  finally{if(mounted.current&&epoch.current===version)setBusy(false);}
 }
 const pending=!!status.attemptId&&["starting","waiting_device","polling","exchanging"].includes(status.phase);
 return <section className="account-panel codex-connection" aria-labelledby="chatgpt">
  <h2 id="chatgpt">ChatGPT models and usage</h2>
  <p>Check the models and usage available with your ChatGPT plan. Codex plan limits apply.</p>
  <p>Generating studio images requires a separate API connection.</p>
  <details><summary>How sign-in works</summary><p>Open OpenAI’s sign-in window, enter your one-time code and approve the connection. No download required.</p></details>
  <p>Your connection is encrypted on our server. Your OpenAI password stays with OpenAI.</p>
  {!signedIn?<p>Sign in to your workspace first to connect your plan.</p>:!enabled?<p>ChatGPT connection setup is being completed. Your API connections remain available.</p>:<>
   {status.connected&&<p><strong>Connected · {status.label||"ChatGPT account"}</strong>{status.plan?" · "+status.plan:""}</p>}
   {status.needsReauth&&<p>Your OpenAI connection needs sign-in again.</p>}
   {pending?<div className="codex-device-step">
    {status.userCode&&<><p>Enter this code on OpenAI’s page:</p><output className="codex-device-code" aria-label="One-time sign-in code">{status.userCode}</output>
     <button type="button" className="neutral-button" onClick={async()=>{try{await navigator.clipboard.writeText(status.userCode!);setNotice("Code copied.");}catch{setError("Copy was blocked. Select the code above to copy it.");}}}>Copy code</button></>}
    <a className="neutral-button" href={verify} target="_blank" rel="noopener noreferrer">Open OpenAI sign-in</a>
    <p role="status">Waiting for OpenAI approval…{status.expiresAt?" Expires at "+new Date(status.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+".":""}</p>
    <button type="button" className="neutral-button" disabled={busy} onClick={()=>void act("cancel")}>Cancel sign-in</button>
   </div>:<button type="button" className={status.connected?"neutral-button":"primary-button"} disabled={busy||status.phase==="loading"} onClick={()=>void act("start")}>{busy?"Connecting…":status.connected?"Connect another ChatGPT account":"Continue with ChatGPT"}</button>}
   {status.phase==="expired"&&<p role="status">That code expired. Start a new sign-in.</p>}
   {status.phase==="failed"&&<p role="status">Sign-in was not completed. You can try again.</p>}
   {status.connected&&!pending&&<div className="codex-device-step">
    <button type="button" className="neutral-button" disabled={busy} onClick={()=>void act("check")}>Refresh usage and models</button>
    <button type="button" className="neutral-button" disabled={busy} onClick={()=>void act("disconnect")}>Disconnect ChatGPT</button>
    <p>Disconnect removes the saved connection here. You can also manage access in <a href="https://chatgpt.com/#settings/Security" target="_blank" rel="noopener noreferrer">ChatGPT settings</a>.</p>
   </div>}
   {status.checkedAt&&<div><p>Checked {new Date(status.checkedAt).toLocaleTimeString()}. Readings are kept only in this page’s memory.</p>
    {!status.usageAvailable||!status.windows?.length?<p>No usage reading is available.</p>:<ul>{status.windows.map((w,i)=><li key={i}>{w.kind}: {w.usedPercent===undefined?"No percentage available":w.usedPercent+"% used"}{w.resetsAt?" · resets "+new Date(w.resetsAt*1000).toLocaleString():""}</li>)}</ul>}
    <details><summary>Available models ({status.models?.length||0})</summary>{!status.models?.length?<p>No model list is available.</p>:<ul>{status.models.map(m=><li key={m.id}>{m.name}</li>)}</ul>}</details>
   </div>}
  </>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
