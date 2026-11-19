"use client";
import {elementKinds,elementDefinitions,type Element,type ElementKind} from "@/lib/elements";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,Pencil,Plus,Trash2,Upload,Link2,ScanFace,Rotate3d,Glasses,TriangleAlert,ImagePlus} from 'lucide-react';
import type {FaceCheck} from '@/lib/face-check';
import type {useStudio} from '@/lib/use-studio';
import {ProviderChoice} from "./provider-choice";
import type {Persona,Style} from '@/lib/types';
import {StyleLibraryGrid} from '@/components/creative/style-library-grid';
import {YouTubePicker} from './youtube-picker';
import type {Channel,ChannelVideo} from '@/lib/youtube';
type Studio=ReturnType<typeof useStudio>;
const steps=[
 {title:'Make your face easy to see',body:'Use a sharp, well-lit photo with your whole face visible. Avoid sunglasses, masks and anything covering your features.',goodTile:0,badTile:3,good:'Clear, unobstructed face',bad:'Covered eyes or face'},
 {title:'Use two or three different photographs',body:'Include a front view, a slight angle and a natural expression. Keep the same person in every image.',goodTile:1,badTile:4,good:'One person, different angles',bad:'Features hidden by a mask'},
 {title:'Keep the light natural',body:'Choose clear light and realistic detail. Avoid strong filters, blur or heavy edits that change your appearance.',goodTile:2,badTile:5,good:'Sharp detail and natural light',bad:'Blur, deep shadows or filters'},
];
function PersonaGuidelines({onDone}:{onDone:(skip:boolean)=>Promise<void>}){
 const [step,setStep]=useState(0),[skip,setSkip]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),data=steps[step];
 async function finish(){setBusy(true);try{await onDone(skip);}catch{setError('Your preference could not save. Try again.');}finally{setBusy(false);}}
 return <section className="persona-guidelines"><ol className="tutorial-steps" aria-label="Tutorial progress">{steps.map((s,i)=><li key={s.title} aria-current={step===i?'step':undefined}><span>{i+1}</span><small>{i===step?'Current step':i<step?'Complete':'Next'}</small></li>)}</ol>
 <div className="guideline-visual" aria-hidden="true">{[data.goodTile,data.badTile].map((tile,i)=><div key={i}><span className="guideline-photo" style={{backgroundPosition:`${tile%3*50}% ${tile<3?0:100}%`}}/>{i===0&&<Check size={22}/>}</div>)}</div>
 <div className="guideline-captions"><span>{data.good}</span><span>{data.bad}</span></div><h3>{data.title}</h3><p>{data.body}</p>
 <label className="permission-field"><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/>Don’t show this tutorial again</label>
 <div className="consent-actions"><button type="button" className="quiet-button" disabled={busy} onClick={()=>finish()}>Skip Tutorial</button><button type="button" className="primary-button" disabled={busy} onClick={()=>step<2?setStep(x=>x+1):finish()}>{step<2?'Next':'Create your Persona'}</button></div>{error&&<p role="alert">{error}</p>}
 </section>;
}
/** Three short rules, always visible above the persona upload. */
function PersonaGuide(){
 const tips=[{icon:ScanFace,title:'Clear face, good light',body:'Sharp, front-lit, whole face visible.'},{icon:Rotate3d,title:'2–3 different angles',body:'Front, a slight turn, a natural expression.'},{icon:Glasses,title:'No sunglasses or hats',body:'Nothing covering the eyes or face.'}];
 return <ol className="persona-guide" aria-label="Photo guide">{tips.map(({icon:Icon,title,body},i)=><li key={title}><span className="persona-guide-icon" aria-hidden="true"><Icon size={20}/><b>{i+1}</b></span><span><strong>{title}</strong><small>{body}</small></span></li>)}</ol>;
}
function RenameForm({kind,item,studio,onDone}:{kind:'persona'|'style'|'element';item:Persona|Style|Element;studio:Studio;onDone:(saved:string|null)=>void}){
 const [value,setValue]=useState(item.name),[error,setError]=useState(''),[pending,setPending]=useState(false),input=useRef<HTMLInputElement>(null),errorEl=useRef<HTMLParagraphElement>(null),errorId='rename-error-'+item.id,inputId='rename-'+item.id;
 useEffect(()=>{input.current?.focus();input.current?.select();},[]);
 // Keep the whole message on screen when the form sits at the bottom edge of the dialog.
 useEffect(()=>{if(error)errorEl.current?.scrollIntoView({block:'nearest'});},[error]);
 async function submit(){
  if(pending)return;
  setError('');setPending(true);
  try{const next=await studio.renameProfile(kind,item.id,value);onDone((next&&typeof next.name==='string'?next.name:value.trim()));}
  catch(e){setError(e instanceof Error?e.message:'This name could not save. Try again.');setPending(false);requestAnimationFrame(()=>input.current?.focus());}
 }
 return <form className="profile-rename" noValidate aria-busy={pending} onSubmit={e=>{e.preventDefault();void submit();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!pending)onDone(null);}}}>
  <label htmlFor={inputId}>{kind==='persona'?'Persona name':kind==='element'?'Element name':'Style name'}</label>
  <div className="profile-rename-row">
   <input id={inputId} ref={input} value={value} onChange={e=>{setValue(e.target.value);if(error)setError('');}} readOnly={pending} autoComplete="off" spellCheck={false} aria-invalid={error?true:undefined} aria-describedby={error?errorId:undefined}/>
   <div className="profile-rename-actions"><button className="primary-button" type="submit" disabled={pending}>{pending?'Saving…':'Save name'}</button><button className="quiet-button" type="button" disabled={pending} onClick={()=>onDone(null)}>Cancel</button></div>
  </div>
  {error&&<p ref={errorEl} id={errorId} className="profile-rename-error" role="alert">{error}</p>}
 </form>;
}
export function ProfileManager({kind,studio,selectedIds,onChoose,onPreset,onClose,onTitle}:{kind:'persona'|'style'|'element';studio:Studio;selectedIds:string[];onChoose:(id:string)=>void;onPreset:(name:string)=>void;onClose:()=>void;onTitle?:(title:string)=>void}){
 const [elementKind,setElementKind]=useState<ElementKind>('prop');
 const [provider,setProvider]=useState<"openai"|"google">("openai");
 const [faceNotes,setFaceNotes]=useState<Record<string,string>>({}),[checking,setChecking]=useState(0);
 const [view,setView]=useState<'library'|'tutorial'|'create'|'youtube'|'study'>('library'),[studyUrl,setStudyUrl]=useState(''),[studied,setStudied]=useState<{name:string;palette:{hex:string;share:number}[]}|null>(null),[library,setLibrary]=useState<'public'|'private'>(()=>kind==='style'&&!studio.styles.length?'public':'private'),[source,setSource]=useState<'upload'|'youtube'>('upload'),[name,setName]=useState(''),[notes,setNotes]=useState(''),[files,setFiles]=useState<File[]>([]),[previews,setPreviews]=useState<string[]>([]),[permission,setPermission]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false),[imported,setImported]=useState<{channel:Channel;videos:ChannelVideo[]}|null>(null),[renamingId,setRenamingId]=useState(''),[announcement,setAnnouncement]=useState(''),focusAfter=useRef('');
 useEffect(()=>{if(!renamingId&&focusAfter.current){document.getElementById('rename-trigger-'+focusAfter.current)?.focus();focusAfter.current='';}},[renamingId]);
 useEffect(()=>{onTitle?.(view==='library'?(kind==='persona'?'Your personas':kind==='element'?'Your elements':'Your styles'):view==='tutorial'?'Persona Guidelines':'Create Your '+(kind==='persona'?'Persona':kind==='element'?'Element':'Style'));},[view,kind]);
 const items=kind==='persona'?studio.personas:kind==='element'?studio.elements:studio.styles,label=kind==='persona'?'Persona':kind==='element'?'Element':'Style';
 useEffect(()=>{const urls=files.map(f=>URL.createObjectURL(f));setPreviews(urls);return()=>urls.forEach(URL.revokeObjectURL);},[files]);
 function create(){setError('');setView(kind==='persona'&&!studio.skipPersonaTutorial?'tutorial':'create');}
 function accept(incoming:File[]){if(incoming.some(f=>!(/^image\/(png|jpeg|webp|avif|heic|heif)$/.test(f.type)||/\.(png|jpe?g|webp|avif|heic|heif)$/i.test(f.name))||f.size>30*1024*1024)){setError('Use image files (PNG, JPG, WebP, HEIC or AVIF), up to 30 MB each. They are resized before upload.');return;}const next=[...files,...incoming];if(next.length>3){setError('Use at most 3 images.');return;}setError('');if(kind==='persona'){void checkFaces(incoming);return;}setFiles(next);}
 // A face only stays sharp in the thumbnail if the photo has detail to give: flag small originals.
 // Each persona photo is checked in the browser: exactly one face (rejected otherwise), and a warning when it is small.
 async function checkFaces(list:File[]){
  setChecking(n=>n+1);
  try{
   const kept:File[]=[],notes:Record<string,string>={};let rejection='';
   let check:(f:File)=>Promise<FaceCheck>;
   try{check=(await import('@/lib/face-check')).checkFace;}catch{check=async()=>({ok:false,reason:'unavailable'});}
   for(const f of list){
    let result:FaceCheck;try{result=await Promise.race([check(f),new Promise<FaceCheck>(r=>setTimeout(()=>r({ok:false,reason:'unavailable'}),8000))]);}catch{result={ok:false,reason:'unavailable'};}
    if(!result.ok&&result.reason==='no-face'){rejection='No face found. Use a clear photo of one person.';continue;}
    if(!result.ok&&result.reason==='many-faces'){rejection='More than one face. Use a photo of just this person.';continue;}
    if(result.ok&&result.small)notes[f.name+f.size]=`The face is small (${result.faceHeight}px). Use a closer photo so it stays sharp.`;
    kept.push(f);
   }
   setFiles(current=>[...current,...kept].slice(0,3));setFaceNotes(current=>({...current,...notes}));
   if(rejection)setError(rejection);else if(kept.length)void warnSmall(kept);
  }finally{setChecking(n=>n-1);}
 }
 async function warnSmall(list:File[]){for(const f of list){try{const b=await createImageBitmap(f);const short=Math.min(b.width,b.height);b.close();if(short<720){setError(`${f.name} is small (${short}px). Use a photo at least 720px on its short side so the face stays sharp.`);return;}}catch{}}}
 async function save(){
  setError('');if(name.trim().length<3){setError('Name must be at least 3 characters');return;}
  if(kind==='persona'&&!permission){setError('Confirm you have permission to use this person’s face.');return;}
  if(checking){setError('Still checking your photos. Try again in a moment.');return;}
  if(source==='upload'&&(files.length<(kind==='persona'?2:1)||files.length>3)){setError(kind==='persona'?'Upload 2 or 3 photos of this persona.':'Use 1 to 3 style references.');return;}
  if(source==='youtube'&&(!imported||imported.videos.length<1||imported.videos.length>3)){setError('Select 1 to 3 videos.');return;}
  setSaving(true);
  try{const images=source==='youtube'?await Promise.all(imported!.videos.map(v=>studio.importYouTube(v.id))):files;
   const profile=await studio.saveProfile(kind,name,notes,images,permission,source==='youtube'?{kind:'youtube',channelId:imported!.channel.id,videoIds:imported!.videos.map(v=>v.id)}:undefined,kind==='element'?elementKind:undefined);
   onChoose(profile.id);onClose();
  }catch(e){setError(e instanceof Error?e.message:'Your references could not save.');}finally{setSaving(false);}
 }
 if(view==='tutorial')return <PersonaGuidelines onDone={async skip=>{if(skip)await studio.saveTutorialPreference(true);setView('create');}}/>;
 async function study(){setError('');if(!studyUrl.trim()){setError('Paste a YouTube video or channel link.');return;}if(name.trim()&&name.trim().length<3){setError('Name must be at least 3 characters');return;}setSaving(true);try{const result=await studio.api('/api/styles/study',{url:studyUrl.trim(),...(name.trim()?{name:name.trim()}:{}),notes});await studio.load();setStudied({name:result.profile.name,palette:result.palette});onChoose(result.profile.id);}catch(e){setError(e instanceof Error?e.message:'This style could not be studied.');}finally{setSaving(false);}}
 if(view==='study')return <form className="profile-create" onSubmit={e=>{e.preventDefault();void study();}} noValidate><button className="quiet-button back-button" type="button" disabled={saving} onClick={()=>{setStudied(null);setView('create');}}><ArrowLeft size={15}/>Create your Style</button>{studied?<section aria-live="polite"><p><strong>{studied.name}</strong> saved to your private styles.</p><div className="style-palette style-palette-large" role="list" aria-label="Measured palette">{studied.palette.map(c=><span key={c.hex} role="listitem" title={c.hex} aria-label={c.hex} style={{background:c.hex}}/>)}</div><p className="dialog-footnote">{studied.palette.map(c=>c.hex).join(' · ')}</p><button className="primary-button full-width" type="button" onClick={onClose}>Use this style</button></section>:<><label htmlFor="study-url">YouTube video or channel link<input id="study-url" value={studyUrl} onChange={e=>{setStudyUrl(e.target.value);if(error)setError('');}} placeholder="https://youtube.com/watch?v=… or @channel" aria-describedby={error?'profile-error':undefined}/></label><label htmlFor="study-name">Name (optional)<input id="study-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="Defaults to the channel name"/></label><p className="dialog-footnote">A video link saves its thumbnail. A channel link saves its 3 most popular thumbnails and needs your YouTube key from Connections. The colour palette is measured from the pixels; no AI credits are used.</p>{error&&<div id="profile-error" className="profile-validation" role="alert"><p>{error}</p><button type="button" className="quiet-button" onClick={()=>setError('')}>Dismiss error</button></div>}<button className="primary-button full-width" disabled={saving||!studio.cloud} type="submit">{saving?'Studying thumbnails…':'Study and save style'}</button>{!studio.cloud&&<p className="dialog-footnote">Sign in to study a style from YouTube.</p>}</>}</form>;
 if(view==='youtube')return <><button type="button" className="quiet-button" disabled={saving} onClick={()=>setView('create')}><ArrowLeft size={15}/>Create your Style</button><YouTubePicker api={studio.api} onSelected={(videos,channel)=>{setImported({videos,channel});if(!name.trim())setName(channel.name.slice(0,80));setSource('youtube');setView('create');}}/></>;
 if(view==='library')return <section className="profile-manager"><p className="dialog-description">{kind==='persona'?'Keep the same person or character across your thumbnails.':kind==='element'?'Save objects, brand marks, places and clothing to reuse in your thumbnails.':'Build a consistent visual language from your own references.'}</p>
 <details><summary>Profile preparation settings</summary><ProviderChoice value={provider} onChange={setProvider} config={studio.config} label="Profile preparation provider" disabled={!!studio.busy}/></details>{kind==='style'&&<div className="source-tabs" aria-label="Style collection"><button type="button" className={library==='public'?'active':''} onClick={()=>setLibrary('public')}>Library</button><button type="button" className={library==='private'?'active':''} onClick={()=>setLibrary('private')}>Private</button></div>}
 {kind==='style'&&library==='public'?<StyleLibraryGrid onPick={id=>{onPreset('library:'+id);onClose();}}/>:<div className="profile-collection">{items.map(item=><article className="profile-item" key={item.id}><button type="button" className="profile-choose" onClick={()=>{onChoose(item.id);onClose();}}><div className="profile-cover">{item.refs.filter(path=>studio.images[path]).length?item.refs.slice(0,3).filter(path=>studio.images[path]).map(path=><img key={path} src={studio.images[path]} alt={item.name+' reference'}/>):<ImagePlus size={24} aria-label="Reference image unavailable"/>}</div><div><strong>{item.name}</strong>{kind==='element'&&<span className="element-kind-badge">{elementDefinitions[(item as Element).kind].label}</span>}<span>{item.profile_status==='ready'?'Profile prepared':item.refs.length+' references saved'}</span>{kind==='style'&&Array.isArray((item as Style).source?.palette)&&<span className="style-palette" aria-label={'Palette '+(item as Style).source!.palette!.join(', ')}>{(item as Style).source!.palette!.map(c=><span key={c} style={{background:c}}/>)}</span>}</div>{selectedIds.includes(item.id)&&<Check size={17}/>}</button>{renamingId===item.id?<RenameForm kind={kind} item={item} studio={studio} onDone={saved=>{focusAfter.current=item.id;setAnnouncement(saved?'Renamed to '+saved+'.':'');setRenamingId(current=>current===item.id?'':current);}}/>:<div className="profile-item-actions"><button type="button" id={'rename-trigger-'+item.id} className="quiet-button" aria-label={'Rename '+item.name} disabled={!!studio.busy} onClick={()=>{setAnnouncement('');setRenamingId(item.id);}}><Pencil size={14} aria-hidden="true"/>Rename</button><button type="button" className="neutral-button" title="Uses your connected provider's credits" disabled={!studio.cloud||!studio.config?.ai||!studio.config?.[provider]||!!studio.busy} onClick={()=>studio.run('Preparing reference profile',()=>studio.prepare(kind,item.id,provider))}>Prepare profile · uses credits</button><button type="button" className="icon-button" aria-label={'Delete '+item.name} onClick={()=>{if(confirm('Delete this '+label.toLowerCase()+'?'))void studio.run('Deleting profile',()=>studio.remove(kind==='persona'?'personas':kind==='element'?'elements':'styles',item.id));}}><Trash2 size={15}/></button></div>}</article>)}{!items.length&&<p className="profile-empty">Your {kind==='persona'?'personas':'private styles'} will appear here.</p>}</div>}<p className="sr-only" role="status">{announcement}</p>
 <button type="button" className="neutral-button full-width" onClick={create}><Plus size={16}/>Create {kind}</button><p className="dialog-footnote">Photos guide the image model. Preparing a profile uses your connected API to describe references; it does not train a custom model.</p></section>;
 return <form className="profile-create" onSubmit={e=>{e.preventDefault();void save();}} noValidate>
 <button className="quiet-button back-button" type="button" disabled={saving} onClick={()=>setView('library')}><ArrowLeft size={15}/>Your collection</button>
 {kind==='style'&&<div className="source-tabs"><button type="button" onClick={()=>setView('study')}><Link2 size={15}/>Study a link</button><button type="button" className={source==='youtube'?'active':''} onClick={()=>setView('youtube')}><Link2 size={15}/>Pick from channel</button><button type="button" className={source==='upload'?'active':''} onClick={()=>{setSource('upload');setImported(null);}}><Upload size={15}/>Upload Thumbnails</button></div>}
 {kind==='persona'&&<PersonaGuide/>}
 <label htmlFor="profile-name">Name<input id="profile-name" value={name} onChange={e=>{setName(e.target.value);if(error.includes('Name'))setError('');}} minLength={3} maxLength={80} aria-invalid={error.includes('Name')} aria-describedby={error?'profile-error':undefined} placeholder={kind==='persona'?'e.g. Derrick':kind==='element'?'e.g. Acme logo':'e.g. Editorial contrast'}/></label>
 {kind==='element'&&<label htmlFor="element-kind">Element kind<select aria-label="Element kind" id="element-kind" value={elementKind} onChange={e=>setElementKind(e.target.value as ElementKind)}>{elementKinds.map(k=><option key={k} value={k}>{elementDefinitions[k].label}</option>)}</select><small className="dialog-footnote">{elementDefinitions[elementKind].description}</small></label>}
 <label htmlFor="profile-notes">Creative guidance<textarea id="profile-notes" maxLength={800} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={kind==='persona'?'Identity details, wardrobe and expressions to preserve…':kind==='element'?'Details to preserve and how to use this element…':'Palette, lighting, composition and text treatment…'}/></label>
 {source==='youtube'&&imported?<><p>{imported.videos.length} reference{imported.videos.length===1?'':'s'} from {imported.channel.name}</p><div className="profile-photo-grid">{imported.videos.map(v=><img key={v.id} src={v.thumbnail} alt={v.title}/>)}</div><button className="quiet-button" type="button" onClick={()=>setView('youtube')}>Change selected videos</button></>:<><label className="profile-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();accept(Array.from(e.dataTransfer.files));}}><Upload size={24}/><strong>{kind==='persona'?'Upload 2 or 3 photos':kind==='element'?'Upload 1 to 3 images':'Upload 1 to 3 thumbnails'}</strong><span>PNG, JPG, JPEG or WebP · up to 5 MB each</span><input type="file" multiple aria-label="Profile reference photos" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif" onChange={e=>accept(Array.from(e.target.files||[]))}/></label>{previews.length>0&&<div className={"profile-photo-grid"+(kind==='persona'?" profile-photo-grid--persona":"")}>{previews.map((src,i)=>{const note=files[i]&&faceNotes[files[i].name+files[i].size];return <figure key={src}><img src={src} alt={'Reference '+(i+1)} width={96} height={96}/><button type="button" aria-label={'Remove reference '+(i+1)} onClick={()=>setFiles(xs=>xs.filter((_,n)=>n!==i))}><Trash2 size={14}/></button>{note&&<figcaption><TriangleAlert size={12} aria-hidden="true"/>{note}</figcaption>}</figure>;})}</div>}<p className="photo-count" aria-live="polite">{checking?'Checking photos…':files.length+'/3 selected'}</p></>}
 {kind==='persona'&&<label className="permission-field"><input type="checkbox" checked={permission} aria-required="true" onChange={e=>{setPermission(e.target.checked);if(e.target.checked&&error.startsWith('Confirm'))setError('');}}/>I have permission to use this person’s face.</label>}
 {error&&<div id="profile-error" className="profile-validation" role="alert"><p>{error}</p><button type="button" className="quiet-button" onClick={()=>setError('')}>Dismiss error</button></div>}
 <button className="primary-button full-width" disabled={saving||!!checking} type="submit">{saving?'Saving references…':'Create '+kind}</button><p className="dialog-footnote">This saves a reusable reference profile. No likeness training or exact identity guarantee is implied.</p>
 </form>;
}
