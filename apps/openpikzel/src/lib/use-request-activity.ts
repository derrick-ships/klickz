"use client";
import {useEffect,useRef,useState} from "react";
export type RequestJob={id:string;operation:string;state:string;max_provider_calls:number;created_at?:string;result?:{creation?:{id:string};creations?:{id:string}[];creationId?:string;kind?:string;value?:{prompt?:string;reply?:string};provider?:string;model?:string}};
type Reader=(path:string,signal?:AbortSignal)=>Promise<any>;
const pending=(job:RequestJob)=>job.state==="queued"||job.state==="running";
export function useRequestActivity({user,cloud,read,onSucceeded}:{user:string|null;cloud:boolean;read:Reader;onSucceeded:()=>Promise<void>}){
 const [stateOwner,setStateOwner]=useState<string|null>(null);
 const [jobs,setJobs]=useState<RequestJob[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[paused,setPaused]=useState(false);
 const latest=useRef({read,onSucceeded});latest.current={read,onSucceeded};
 const wake=useRef<(()=>Promise<void>)|null>(null),stop=useRef<(()=>void)|null>(null);
 const owner=cloud?user:null,ownerNow=useRef(owner);ownerNow.current=owner;
 useEffect(()=>{
  setStateOwner(owner);setJobs([]);setError("");setPaused(false);setLoading(false);
  if(!owner){wake.current=null;stop.current=null;return;}
  let active=true,isPaused=false,started=Date.now(),ticket=0,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  const seen=new Map<string,string>();
  async function poll(){
   if(!active||ownerNow.current!==owner||isPaused)return;
   clearTimeout(timer);controller?.abort();controller=new AbortController();const attempt=++ticket;
   setLoading(true);setError("");
   try{
    const result=await latest.current.read("/api/jobs",controller.signal);
    if(!active||attempt!==ticket||ownerNow.current!==owner)return;
    const next:RequestJob[]=Array.isArray(result.jobs)?result.jobs:[];
    const newlySucceeded=next.some(job=>job.state==="succeeded"&&["queued","running"].includes(seen.get(job.id)||""));
    next.forEach(job=>seen.set(job.id,job.state));setJobs(next);
    if(newlySucceeded)void latest.current.onSucceeded().catch(()=>{if(active&&ownerNow.current===owner)setError("The request finished, but the library could not refresh. Use Refresh activity to read it again.");});
    if(next.some(pending)){
     if(Date.now()-started<600000&&!isPaused)timer=setTimeout(()=>void poll(),5000);
     else{isPaused=true;setPaused(true);}
    }
   }catch(e){if(active&&attempt===ticket&&ownerNow.current===owner&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Activity could not refresh. Existing requests were not resubmitted.");}
   finally{if(active&&attempt===ticket&&ownerNow.current===owner)setLoading(false);}
  }
  wake.current=async()=>{isPaused=false;setPaused(false);started=Date.now();await poll();};
  stop.current=()=>{isPaused=true;ticket++;clearTimeout(timer);controller?.abort();setLoading(false);setPaused(true);};
  void poll();
  return()=>{active=false;ticket++;clearTimeout(timer);controller?.abort();wake.current=null;stop.current=null;};
 },[owner]);
 const visibleJobs=stateOwner===owner?jobs:[];
 return {jobs:visibleJobs,loading:stateOwner===owner&&loading,error:stateOwner===owner?error:"",paused:stateOwner===owner&&paused,active:visibleJobs.filter(pending).length,refresh:()=>wake.current?.()||Promise.resolve(),pause:()=>stop.current?.()};
}
