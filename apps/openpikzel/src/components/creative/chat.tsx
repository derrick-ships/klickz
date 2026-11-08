"use client";
import {useEffect,useId,useRef,useState,type MouseEvent as ReactMouseEvent} from 'react';
import {Search,MessageSquare,Pencil,Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {groupChats,searchChats,type Conversation} from '@/lib/workspaces';
import type {Creation} from '@/lib/types';
export function ChatHistory({chats,creations,active,busy,onOpen}:{chats:Conversation[];creations:Creation[];active:string|null;busy:boolean;onOpen:(chat:Conversation)=>void}){
 const [query,setQuery]=useState('');
 return <div className="chat-history"><label className="chat-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search your chats" placeholder="Search your chats"/></label>
 {groupChats(searchChats(chats,creations,query)).map(group=><section key={group.label}><h3>{group.label}</h3>{group.items.map(chat=><button key={chat.id} disabled={busy} className={'chat-row '+(active===chat.id?'selected':'')} onClick={()=>onOpen(chat)} aria-label={"Open chat: "+chat.title} aria-current={active===chat.id?'true':undefined}><MessageSquare size={15}/><span>{chat.title}</span></button>)}</section>)}
 {!chats.length&&<p className="history-empty">Start a chat to keep your prompts and thumbnails together.</p>}{query&&!searchChats(chats,creations,query).length&&<p>No matching chats.</p>}</div>;
}
export function ChatTitle({title,onSave,busy}:{title:string;onSave:(name:string)=>Promise<void>;busy:boolean}){
 const [editing,setEditing]=useState(false),[name,setName]=useState(title),[error,setError]=useState('');
 return <div className="chat-title">{editing?<form onSubmit={async e=>{e.preventDefault();if(!name.trim())return;try{await onSave(name.trim().slice(0,100));setEditing(false);}catch{setError('The name could not save. Try again.');}}}><input autoFocus aria-label="Chat name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(false);}}}/><button className="icon-button" aria-label="Save chat name"><Check size={17}/></button></form>:<><span>{title}</span><button disabled={busy} className="icon-button" aria-label="Rename chat" onClick={()=>{setName(title);setEditing(true);}}><Pencil size={14}/></button></>}{error&&<p role="alert">{error}</p>}</div>;
}
export function ChatTimeline({items,images,active,onChoose}:{items:Creation[];images:Record<string,string>;active:string|null;onChoose:(c:Creation)=>void}){
 const viewport=useRef<HTMLDivElement>(null),id=useId(),[edges,setEdges]=useState({start:true,end:true});
 useEffect(()=>{
  const el=viewport.current;if(!el)return;let frame=0;
  function measure(){const next={start:el!.scrollLeft<=1,end:el!.scrollLeft+el!.clientWidth>=el!.scrollWidth-2};setEdges(old=>old.start===next.start&&old.end===next.end?old:next);}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);}
  const observer=new ResizeObserver(schedule);observer.observe(el);el.addEventListener('scroll',schedule,{passive:true});measure();
  return()=>{observer.disconnect();el.removeEventListener('scroll',schedule);cancelAnimationFrame(frame);};
 },[items.length]);
 function scroll(direction:number,event:ReactMouseEvent<HTMLButtonElement>){const el=viewport.current;if(el)el.scrollBy({left:direction*Math.max(180,el.clientWidth*.8),behavior:event.detail===0||matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 if(!items.length)return null;
 return <section className="chat-timeline" aria-label="Chat history"><header className="revision-strip-heading"><h2>In this chat</h2><div><button className="icon-button" aria-label="Previous revisions" aria-controls={id} disabled={edges.start} onClick={e=>scroll(-1,e)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label="Next revisions" aria-controls={id} disabled={edges.end} onClick={e=>scroll(1,e)}><ChevronRight size={18}/></button></div></header><div ref={viewport} id={id} role="region" aria-label="Thumbnail revision history" tabIndex={0}>{[...items].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(item=><article key={item.id} className={item.id===active?'selected':''}><p>{item.prompt}</p><button onClick={()=>onChoose(item)} aria-label={'Open '+item.title} aria-current={item.id===active?'true':undefined}>{item.image_path&&images[item.image_path]?<img src={images[item.image_path]} alt={item.title} draggable={false}/>:<span>{item.status==='draft'?'Saved draft':item.status}</span>}</button><small>{item.mode} · {item.settings?.model||'Uploaded image'}{item.parent_id?' · linked revision':''}</small></article>)}</div></section>;
}
