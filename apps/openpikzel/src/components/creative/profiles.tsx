"use client";
import {useEffect,useState} from 'react';
import {ArrowLeft,Check,Plus,Trash2,Upload,Link2} from 'lucide-react';
import type {useStudio} from '@/lib/use-studio';
import {ProviderChoice} from "./provider-choice";
import type {Persona,Style} from '@/lib/types';
import {publicStyles} from '@/lib/workspaces';
import {YouTubePicker} from './youtube-picker';
import type {Channel,ChannelVideo} from '@/lib/youtube';
type Studio=ReturnType<typeof useStudio>;
const steps=[
 {title:'Make your face easy to see',body:'Use a sharp, well-lit photo with your whole face visible. Avoid sunglasses, masks and anything covering your features.',goodTile:0,badTile:3,good:'Clear, unobstructed face',bad:'Covered eyes or face'},
 {title:'Use three different photographs',body:'Include a front view, a slight angle and a natural expression. Keep the same person in every image.',goodTile:1,badTile:4,good:'One person, different angles',bad:'Features hidden by a mask'},
 {title:'Keep the light natural',body:'Choose clear light and realistic detail. Avoid strong filters, blur or heavy edits that change your appearance.',goodTile:2,badTile:5,good:'Sharp detail and natural light',bad:'Blur, deep shadows or filters'},
];
function PersonaGuidelines({onDone}:{onDone:(skip:boolean)=>Promise<void>}){
 const [step,setStep]=useState(0),[skip,setSkip]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),data=steps[step];
 async function finish(){setBusy(true);try{await onDone(skip);}catch{setError('Your preference could not save. Try again.');}finally{setBusy(false);}}
 return <section className="persona-guidelines"><ol className="tutorial-steps" aria-label="Tutorial progress">{steps.map((s,i)=><li key={s.title} aria-current={step===i?'step':undefined}><span>{i+1}</span><small>{i===step?'Current step':i<step?'Complete':'Next'}</small></li>)}</ol>
 <div className="guideline-visual" aria-hidden="true">{[data.goodTile,data.badTile].map((tile,i)=><div key={i}><span className="guideline-photo" style={{backgroundPosition:`${tile%3*50}% ${tile<3?0:100}%`}}/>{i===0&&<Check size={22}/>}</div>)}</div>
 <div className="guideline-captions"><span>{data.good}</span><span>{data.bad}</span></div><h3>{data.title}</h3><p>{data.body}</p>
 <label className="permission-field"><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/>Don’t show this tutorial again</label>
 <div className="consent-actions"><button className="quiet-button" disabled={busy} onClick={()=>finish()}>Skip Tutorial</button><button className="primary-button" disabled={busy} onClick={()=>step<2?setStep(x=>x+1):finish()}>{step<2?'Next':'Create your Persona'}</button></div>{error&&<p role="alert">{error}</p>}
 </section>;
}
export function ProfileManager({kind,studio,selectedId,onChoose,onPreset,onClose,onTitle}:{kind:'persona'|'style';studio:Studio;selectedId:string;onChoose:(id:string)=>void;onPreset:(name:string)=>void;onClose:()=>void;onTitle?:(title:string)=>void}){
 const [provider,setProvider]=useState<"openai"|"google">("openai");
 const [view,setView]=useState<'library'|'tutorial'|'create'|'youtube'>('library'),[library,setLibrary]=useState<'public'|'private'>('private'),[source,setSource]=useState<'upload'|'youtube'>('upload'),[name,setName]=useState(''),[notes,setNotes]=useState(''),[files,setFiles]=useState<File[]>([]),[previews,setPreviews]=useState<string[]>([]),[permission,setPermission]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false),[imported,setImported]=useState<{channel:Channel;videos:ChannelVideo[]}|null>(null);
 useEffect(()=>{onTitle?.(view==='library'?(kind==='persona'?'Your personas':'Your styles'):view==='tutorial'?'Persona Guidelines':'Create Your '+(kind==='persona'?'Persona':'Style'));},[view,kind]);
 const items=kind==='persona'?studio.personas:studio.styles,label=kind==='persona'?'Persona':'Style';
 useEffect(()=>{const urls=files.map(f=>URL.createObjectURL(f));setPreviews(urls);return()=>urls.forEach(URL.revokeObjectURL);},[files]);
 function create(){setError('');setView(kind==='persona'&&!studio.skipPersonaTutorial?'tutorial':'create');}
 function accept(incoming:File[]){if(incoming.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>5*1024*1024)){setError('Use PNG, JPG, JPEG or WebP images, up to 5 MB each.');return;}const next=incoming.length===3?incoming:[...files,...incoming];if(next.length>3){setError('Upload exactly 3 images.');return;}setFiles(next);setError('');}
 async function save(){
  setError('');if(name.trim().length<3){setError('Name must be at least 3 characters');return;}
  if(kind==='persona'&&!permission){setError('Confirm you have permission to use these photos and this likeness.');return;}
  if(source==='upload'&&files.length!==3){setError('Upload exactly 3 images');return;}
  if(source==='youtube'&&imported?.videos.length!==3){setError('Select exactly 3 videos.');return;}
  setSaving(true);
  try{const images=source==='youtube'?await Promise.all(imported!.videos.map(v=>studio.importYouTube(v.id))):files;
   const profile=await studio.saveProfile(kind,name,notes,images,permission,source==='youtube'?{kind:'youtube',channelId:imported!.channel.id,videoIds:imported!.videos.map(v=>v.id)}:undefined);
   onChoose(profile.id);onClose();
  }catch(e){setError(e instanceof Error?e.message:'Your references could not save.');}finally{setSaving(false);}
 }
 if(view==='tutorial')return <PersonaGuidelines onDone={async skip=>{if(skip)await studio.saveTutorialPreference(true);setView('create');}}/>;
 if(view==='youtube')return <><button className="quiet-button" disabled={saving} onClick={()=>setView('create')}><ArrowLeft size={15}/>Create your Style</button><YouTubePicker api={studio.api} onSelected={(videos,channel)=>{setImported({videos,channel});if(!name.trim())setName(channel.name.slice(0,80));setSource('youtube');setView('create');}}/></>;
 if(view==='library')return <section className="profile-manager"><p className="dialog-description">{kind==='persona'?'Keep the same person or character across your thumbnails.':'Build a consistent visual language from your own references.'}</p>
 <ProviderChoice value={provider} onChange={setProvider} config={studio.config} label="Profile preparation provider" disabled={!!studio.busy}/>{kind==='style'&&<div className="source-tabs" aria-label="Style collection"><button className={library==='public'?'active':''} onClick={()=>setLibrary('public')}>Public</button><button className={library==='private'?'active':''} onClick={()=>setLibrary('private')}>Private</button></div>}
 {kind==='style'&&library==='public'?<><p className="dialog-footnote">Original OpenPikzels directions. Your private styles are never published here.</p><div className="public-styles">{publicStyles.map(style=><button key={style.name} onClick={()=>{onPreset(style.name);onClose();}}><div className="style-palette" aria-hidden="true">{style.colors.map(c=><span key={c} style={{background:c}}/>)}</div><strong>{style.name}</strong><p>{style.description}</p></button>)}</div></>:<div className="profile-collection">{items.map(item=><article className="profile-item" key={item.id}><button className="profile-choose" onClick={()=>{onChoose(item.id);onClose();}}><div className="profile-cover">{item.refs.slice(0,3).map(path=><img key={path} src={studio.images[path]} alt={item.name+' reference'}/>)}</div><div><strong>{item.name}</strong><span>{item.profile_status==='ready'?'Profile prepared':item.refs.length+' references saved'}</span></div>{selectedId===item.id&&<Check size={17}/>}</button><div className="profile-item-actions"><button className="quiet-button" disabled={!studio.cloud||!studio.config?.ai||!studio.config?.[provider]||!!studio.busy} onClick={()=>studio.run('Preparing reference profile',()=>studio.prepare(kind,item.id,provider))}>Prepare profile</button><button className="icon-button" aria-label={'Delete '+item.name} onClick={()=>{if(confirm('Delete this '+label.toLowerCase()+'?'))void studio.run('Deleting profile',()=>studio.remove(kind==='persona'?'personas':'styles',item.id));}}><Trash2 size={15}/></button></div></article>)}{!items.length&&<p className="profile-empty">Your {kind==='persona'?'personas':'private styles'} will appear here.</p>}</div>}
 <button className="neutral-button full-width" onClick={create}><Plus size={16}/>Create {kind}</button><p className="dialog-footnote">Photos guide the image model. Preparing a profile uses your connected API to describe references; it does not train a custom model.</p></section>;
 return <form className="profile-create" onSubmit={e=>{e.preventDefault();void save();}} noValidate>
 <button className="quiet-button back-button" type="button" disabled={saving} onClick={()=>setView('library')}><ArrowLeft size={15}/>Your collection</button>
 {kind==='style'&&<div className="source-tabs"><button type="button" className={source==='youtube'?'active':''} onClick={()=>setView('youtube')}><Link2 size={15}/>YouTube Channel</button><button type="button" className={source==='upload'?'active':''} onClick={()=>{setSource('upload');setImported(null);}}><Upload size={15}/>Upload Thumbnails</button></div>}
 <label htmlFor="profile-name">Name<input id="profile-name" value={name} onChange={e=>{setName(e.target.value);if(error.includes('Name'))setError('');}} minLength={3} maxLength={80} aria-invalid={error.includes('Name')} aria-describedby={error?'profile-error':undefined} placeholder={kind==='persona'?'e.g. Derrick':'e.g. Editorial contrast'}/></label>
 <label htmlFor="profile-notes">Creative guidance<textarea id="profile-notes" maxLength={800} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={kind==='persona'?'Identity details, wardrobe and expressions to preserve…':'Palette, lighting, composition and text treatment…'}/></label>
 {source==='youtube'&&imported?<><p>3 references from {imported.channel.name}</p><div className="profile-photo-grid">{imported.videos.map(v=><img key={v.id} src={v.thumbnail} alt={v.title}/>)}</div><button className="quiet-button" type="button" onClick={()=>setView('youtube')}>Change selected videos</button></>:<><label className="profile-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();accept(Array.from(e.dataTransfer.files));}}><Upload size={24}/><strong>Upload 3 images</strong><span>PNG, JPG, JPEG or WebP · up to 5 MB each</span><input type="file" multiple aria-label="Profile reference photos" accept="image/png,image/jpeg,image/webp" onChange={e=>accept(Array.from(e.target.files||[]))}/></label>{previews.length>0&&<div className="profile-photo-grid">{previews.map((src,i)=><figure key={src}><img src={src} alt={'Reference '+(i+1)}/><button type="button" aria-label={'Remove reference '+(i+1)} onClick={()=>setFiles(xs=>xs.filter((_,n)=>n!==i))}><Trash2 size={14}/></button></figure>)}</div>}<p className="photo-count">{files.length}/3 selected</p></>}
 {kind==='persona'&&<label className="permission-field"><input type="checkbox" checked={permission} onChange={e=>setPermission(e.target.checked)}/>I have permission to use these photos and this likeness.</label>}
 {error&&<div id="profile-error" className="profile-validation" role="alert"><p>{error}</p><button type="button" className="quiet-button" onClick={()=>setError('')}>Dismiss error</button></div>}
 <button className="primary-button full-width" disabled={saving} type="submit">{saving?'Saving references…':'Create '+kind}</button><p className="dialog-footnote">This saves a reusable reference profile. No likeness training or exact identity guarantee is implied.</p>
 </form>;
}
