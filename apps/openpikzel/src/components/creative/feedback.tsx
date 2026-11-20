"use client";
import {useState} from 'react';
export function FeedbackForm({image,title,onSave}:{image:string;title:string;onSave:(body:string)=>Promise<void>}){
 const [body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 return <form className="feedback-form" onSubmit={async e=>{e.preventDefault();setError('');if(body.trim().length<3){setError('Write at least 3 characters.');return;}setBusy(true);try{await onSave(body);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Your feedback could not save.');}finally{setBusy(false);}}}>
 <img src={image} alt={title}/>{saved?<p className="saved-feedback" role="status">Feedback saved with this thumbnail. Thank you.</p>:<><label htmlFor="thumbnail-feedback">Your feedback</label><textarea id="thumbnail-feedback" rows={5} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="What worked, and what should change?" aria-invalid={!!error} aria-describedby={error?'feedback-error':undefined}/>{error&&<p id="feedback-error" role="alert">{error}</p>}<p className="dialog-footnote">Saved privately in your workspace.</p><button type="submit" className="primary-button full-width" disabled={busy}>{busy?'Saving…':'Submit feedback'}</button></>}
 </form>;
}
