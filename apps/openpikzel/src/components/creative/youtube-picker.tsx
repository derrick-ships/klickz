"use client";
import {useState} from 'react';
import {Check,ArrowLeft,Search} from 'lucide-react';
import type {Channel,ChannelVideo} from '@/lib/youtube';
type Page={channel:Channel;videos:ChannelVideo[];nextPageToken:string|null;notice:string};
export function YouTubePicker({api,onSelected}:{api:(path:string,body:unknown)=>Promise<any>;onSelected:(videos:ChannelVideo[],channel:Channel)=>void}){
 const [query,setQuery]=useState(''),[page,setPage]=useState<Page|null>(null),[order,setOrder]=useState<'recent'|'popular'>('recent'),[selected,setSelected]=useState<ChannelVideo[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function browse(nextOrder=order,token=''){setBusy(true);setError('');try{const result=await api('/api/youtube',{channel:page?.channel.id||query,order:nextOrder,pageToken:token});setPage(result);setOrder(nextOrder);}catch(e){setError(e instanceof Error?e.message:'This channel could not load.');}finally{setBusy(false);}}
 return <section className="youtube-picker">
 {!page?<form onSubmit={e=>{e.preventDefault();void browse();}}><label>YouTube channel<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="@creator or YouTube channel URL" aria-label="YouTube channel"/></label><p className="dialog-footnote">Uses your own YouTube Data API key from <a href="/connect">Connections</a>. Or go back and upload thumbnails, or paste a single video link.</p><button className="primary-button full-width" disabled={busy||!query.trim()}><Search size={16}/>{busy?'Looking up channel…':'Continue'}</button></form>:<>
 <button className="quiet-button" disabled={busy} onClick={()=>{setPage(null);setSelected([]);}}><ArrowLeft size={15}/>Change channel</button>
 <div className="youtube-channel">{page.channel.avatar&&<img src={page.channel.avatar} alt="" referrerPolicy="no-referrer"/>}<div><h3>{page.channel.name}</h3><p>{page.channel.subscribers===null?'Subscribers hidden':new Intl.NumberFormat(undefined,{notation:'compact'}).format(page.channel.subscribers)+' subscribers'} · {new Intl.NumberFormat(undefined,{notation:'compact'}).format(page.channel.videos||0)} videos</p></div></div>
 <div className="source-tabs"><button className={order==='recent'?'active':''} disabled={busy} onClick={()=>browse('recent')}>Recent</button><button className={order==='popular'?'active':''} disabled={busy} onClick={()=>browse('popular')}>Popular</button></div>
 <p className="youtube-selection-count" role="status">Select 1 to 3 videos for your Style · {selected.length}/3 selected</p>
 <div className="youtube-videos">{page.videos.map(v=>{const checked=selected.some(x=>x.id===v.id);return <button key={v.id} className={checked?'selected':''} aria-pressed={checked} aria-label={'Select '+v.title} onClick={()=>{if(checked)setSelected(xs=>xs.filter(x=>x.id!==v.id));else if(selected.length<3)setSelected(xs=>[...xs,v]);}}><div><img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/><span>{v.duration}</span>{checked&&<Check size={18}/>}</div><section><strong>{v.title}</strong><small>{new Intl.NumberFormat(undefined,{notation:'compact'}).format(v.views)} views</small></section></button>;})}</div>
 {page.nextPageToken&&<button className="neutral-button full-width" disabled={busy} onClick={()=>browse(order,page.nextPageToken!)}>Next videos</button>}
 <p className="dialog-footnote">Popular is ordered by YouTube view count. References stay selected as you browse. {page.notice}</p>
 <button className="primary-button full-width" disabled={busy||selected.length<1} onClick={()=>onSelected(selected,page.channel)}>Use selected thumbnails</button>
 </>}
 {error&&<div className="profile-validation" role="alert"><p>{error}</p><button type="button" className="quiet-button" onClick={()=>setError('')}>Dismiss error</button></div>}
 </section>;
}
