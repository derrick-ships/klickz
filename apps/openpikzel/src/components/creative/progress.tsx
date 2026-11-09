"use client";
import {useEffect,useState} from 'react';
import {LoaderCircle} from 'lucide-react';
export function OperationProgress({label}:{label:string}){
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{const start=Date.now();setSeconds(0);const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[label]);
 return <section className="operation-progress" role="status" aria-live="polite" aria-atomic="true"><LoaderCircle className="spin" size={28}/><div><strong>{label}</strong><p>{/generat|applying/i.test(label)?'This request uses the settings you submitted. You can keep drafting your next idea.':'Keep this workspace open while the operation finishes.'}</p><small aria-hidden="true">{seconds}s elapsed · awaiting completion</small></div><span className="operation-track" aria-hidden="true"/></section>;
}
