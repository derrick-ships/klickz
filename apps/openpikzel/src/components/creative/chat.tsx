"use client";
import {useState} from 'react';
import {Search,MessageSquare,Pencil,Check} from 'lucide-react';
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
 if(!items.length)return null;
 return <section className="chat-timeline" aria-label="Chat history"><h2>In this chat</h2><div>{[...items].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(item=><article key={item.id} className={item.id===active?'selected':''}><p>{item.prompt}</p><button onClick={()=>onChoose(item)} aria-label={'Open '+item.title}>{item.image_path&&images[item.image_path]?<img src={images[item.image_path]} alt={item.title}/>:<span>{item.status==='draft'?'Saved draft':item.status}</span>}</button><small>{item.mode} · {item.settings?.model||'Uploaded image'}{item.parent_id?' · linked revision':''}</small></article>)}</div></section>;
}
